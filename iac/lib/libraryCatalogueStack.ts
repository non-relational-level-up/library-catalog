import * as cdk from 'aws-cdk-lib';
import {Duration} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {GitHubStackProps} from './githubStackProps';
import {
    Conditions,
    Effect,
    ManagedPolicy,
    OpenIdConnectProvider,
    PolicyDocument,
    PolicyStatement,
    Role,
    ServicePrincipal,
    WebIdentityPrincipal
} from 'aws-cdk-lib/aws-iam';
import {NodejsFunction, NodejsFunctionProps} from 'aws-cdk-lib/aws-lambda-nodejs';
import {DatabaseCluster, InstanceType} from '@aws-cdk/aws-neptune-alpha';
import {Runtime} from 'aws-cdk-lib/aws-lambda';
import {Cors, LambdaIntegration, RestApi} from 'aws-cdk-lib/aws-apigateway';
import * as path from 'path';
import {HttpMethod} from 'aws-cdk-lib/aws-apigatewayv2';
import {GatewayVpcEndpointAwsService, SubnetType, Vpc} from 'aws-cdk-lib/aws-ec2';
import {Bucket} from 'aws-cdk-lib/aws-s3';

export class LibraryCatalogueStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: GitHubStackProps) {
        super(scope, id, props);
        const appName = 'library-catalogue';

        //Github deploy role
        const githubDomain = 'token.actions.githubusercontent.com';

        const ghProvider = new OpenIdConnectProvider(this, 'githubProvider', {
            url: `https://${githubDomain}`,
            clientIds: ['sts.amazonaws.com'],
        });

        const iamRepoDeployAccess = props?.repositoryConfig.map(
            (r) => `repo:${r.owner}/${r.repo}:*`
        );

        const conditions: Conditions = {
            StringLike: {
                [`${githubDomain}:sub`]: iamRepoDeployAccess,
            },
        };

        new Role(this, `${appName}-deploy-role`, {
            assumedBy: new WebIdentityPrincipal(
                ghProvider.openIdConnectProviderArn,
                conditions
            ),
            inlinePolicies: {
                'deployPolicy': new PolicyDocument({
                    statements: [
                        new PolicyStatement({
                            actions: ['sts:AssumeRole'],
                            effect: Effect.ALLOW,
                            resources: ['arn:aws:iam::*:role/cdk-*']
                        }),
                        new PolicyStatement({
                            actions: ['secretsmanager:GetSecretValue'],
                            effect: Effect.ALLOW,
                            resources: ['*']
                        })
                    ],
                }),
            },
            roleName: 'Library-Catalogue-Deploy-Role',
            description:
                'This role is used via GitHub Actions to deploy with AWS CDK',
            maxSessionDuration: cdk.Duration.hours(1),
        });

        // Neptune
        const neptuneRole = new Role(this, 'neptune-role', {
            assumedBy: new ServicePrincipal('rds.amazonaws.com'),
            managedPolicies: [ManagedPolicy.fromAwsManagedPolicyName('AmazonS3ReadOnlyAccess')]
        });
        const vpc = new Vpc(this, `${appName}-vpc`, {
            maxAzs: 2,
            subnetConfiguration: [
                {
                    name: 'PublicSubnet',
                    subnetType: SubnetType.PUBLIC,
                },
            ],
        });

        vpc.addGatewayEndpoint('vpc-endpoint', {service: GatewayVpcEndpointAwsService.S3});

        const neptuneCluster = new DatabaseCluster(this, `${appName}-neptune-cluster`, {
            vpc: vpc,
            vpcSubnets: {subnets: vpc.publicSubnets},
            dbClusterName: 'LibraryCatalogueDB',
            instanceType: InstanceType.SERVERLESS,
            serverlessScalingConfiguration: {maxCapacity: 2.5, minCapacity: 1},
            associatedRoles: [neptuneRole],
        });

        neptuneCluster.connections.allowDefaultPortFromAnyIpv4();

        const s3Bucket = new Bucket(this, 'library-catalogue-bucket', {
            bucketName: 'library-catalogue-bucket',
        });

        // Lambdas
        const lambdaEnv = {
            'DB_ADDRESS': neptuneCluster.clusterEndpoint.socketAddress,
        };
        const lambdaAppDir = path.resolve(__dirname, '../../lambda');

        const createLambda = (id: string, props: NodejsFunctionProps) => {
            const fn = new NodejsFunction(this, id, {
                runtime: Runtime.NODEJS_20_X,
                environment: lambdaEnv,
                timeout: Duration.seconds(30),
                functionName: id,
                vpc: vpc,
                allowPublicSubnet: true,
                ...props
            });

            return fn;
        };

        const helloLambda = createLambda('hello-lambda', {
            entry: path.join(lambdaAppDir, 'hello.ts'),
        });

        const booksByGenreLambda = createLambda('books-by-genre-lambda', {
            entry: path.join(lambdaAppDir, 'books_by_genre.ts'),
        });

        const booksBySeriesLambda = createLambda('books-by-series-lambda', {
            entry: path.join(lambdaAppDir, 'books_by_series.ts'),
        });

        const suggestionBooksByGenreLambda = createLambda('suggestion-books-by-genre-lambda', {
            entry: path.join(lambdaAppDir, 'suggestion_books_by_genre.ts'),
        });

        const suggestionBooksBySeriesLambda = createLambda('suggestion-books-by-series-lambda', {
            entry: path.join(lambdaAppDir, 'suggestion_books_by_series.ts'),
        });

        const ageGroupLambda = createLambda('age-group-lambda', {
            entry: path.join(lambdaAppDir, 'ageGroup.ts'),
        });

        const suggestionLambda = createLambda('suggestions', {
            entry: path.join(lambdaAppDir, 'suggestions.ts'),
        });

        const addBookLambda = createLambda('add-book-lambda', {
            entry: path.join(lambdaAppDir, 'create_book.ts'),
        });

        // API
        const api = new RestApi(this, `${appName}-api-gateway`, {
            deployOptions: {stageName: 'prod'},
            restApiName: `${appName}-api`,
            defaultCorsPreflightOptions: {
                allowHeaders: Cors.DEFAULT_HEADERS,
                allowOrigins: ['*'],
                allowMethods: Cors.ALL_METHODS,
                allowCredentials: true,
            },
        });

        const apiResource = api.root.addResource('api');
        const suggestResource = apiResource.addResource('suggest');
        apiResource.addResource('hello').addMethod(HttpMethod.GET, new LambdaIntegration(helloLambda));
        apiResource.addResource('genre').addResource('{genre}').addMethod(HttpMethod.GET, new LambdaIntegration(booksByGenreLambda))
        apiResource.addResource('series').addResource('{series}').addMethod(HttpMethod.GET, new LambdaIntegration(booksBySeriesLambda))
        suggestResource.addResource('genre').addResource('{userId}').addMethod(HttpMethod.GET, new LambdaIntegration(suggestionBooksByGenreLambda))
        suggestResource.addResource('series').addResource('{userId}').addMethod(HttpMethod.GET, new LambdaIntegration(suggestionBooksBySeriesLambda))        
        
        apiResource.addResource('suggestions').addMethod(HttpMethod.GET, new LambdaIntegration(suggestionLambda));
        
        apiResource.addResource('ageGroup').addResource('{ageGroup}').addMethod(HttpMethod.GET, new LambdaIntegration(ageGroupLambda));

        apiResource.addResource('addBook').addMethod(HttpMethod.POST, new LambdaIntegration(addBookLambda));
    }
    
}
