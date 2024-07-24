import {type APIGatewayProxyHandler} from 'aws-lambda';
import {getNeptuneConnection} from '../utils/dbUtils';
import * as gremlin from 'gremlin';

export const handler: APIGatewayProxyHandler = async (event) => {
    const {driverConnection, graph} = getNeptuneConnection();
    const statics = gremlin.process.statics;

    try {
        const userId = event.pathParameters?.userId;
        console.log(userId);
        const readList = await graph.V(userId).out().hasLabel('Book').id().toList();
        console.log(readList);
        const output = await graph.V(userId).out().hasLabel('Book').out().hasLabel('Genre').dedup().in_().hasLabel('Book').hasId('b-1').limit(3).values('title').toList();
        await driverConnection.close();
        console.log(output);
        return {
            statusCode: 200,
            body: JSON.stringify(output)
        };
    } catch (e) {
        await driverConnection.close();
        console.log(e);
        return {
            statusCode: 500,
            body: JSON.stringify(e)
        };
    }
};