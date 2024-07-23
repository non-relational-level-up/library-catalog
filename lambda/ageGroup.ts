import {type APIGatewayProxyHandler} from 'aws-lambda';
import {getNeptuneConnection} from '../utils/dbUtils';
import * as gremlin from 'gremlin';

export const handler: APIGatewayProxyHandler = async (event) => {
    const {driverConnection, graph} = getNeptuneConnection();
    const statics = gremlin.process.statics;
    const ageGroup = parseInt(event.pathParameters?.ageGroup || '0', 10);

    if (isNaN(ageGroup)) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: 'Invalid age group parameter' }),
        };
    }

    try {
        const output = await graph.V().valueMap().by(statics.unfold()).toList();
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