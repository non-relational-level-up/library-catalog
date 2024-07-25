import {type APIGatewayProxyHandler} from 'aws-lambda';
import {getNeptuneConnection} from '../utils/dbUtils';
import * as gremlin from 'gremlin';

export const handler: APIGatewayProxyHandler = async (event) => {
    const {driverConnection, graph} = getNeptuneConnection();
    const statics = gremlin.process.statics;

    try {
        const { userName } = JSON.parse(event.body || '{}');
        const user = await graph.addV('Reader').property('name', userName).next();
        await driverConnection.close();
        const output = { user: user }
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