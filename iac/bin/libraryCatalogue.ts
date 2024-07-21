#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { LibraryCatalogueStack } from '../lib/libraryCatalogueStack';

const app = new cdk.App();
new LibraryCatalogueStack(app, 'LibraryCatalogueStack', {
  env: { account: '957617350095', region: 'eu-west-1' },
    tags: {
        "owner": "avishkarm@bbd.co.za",
        "created-using": "cdk",
    },
    repositoryConfig: [
        {owner: 'non-relational-level-up', repo: 'library-catalog'}
    ],
});
