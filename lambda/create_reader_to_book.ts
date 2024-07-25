import {type APIGatewayProxyHandler} from 'aws-lambda';
import {getNeptuneConnection} from '../utils/dbUtils';
import * as gremlin from 'gremlin';

export const handler: APIGatewayProxyHandler = async (event) => {
    const {driverConnection, graph} = getNeptuneConnection();
    const statics = gremlin.process.statics;

    try {
        const { book, reader} = JSON.parse(event.body || '{}');
        const existing = await graph.V(reader).out('has-read').hasId(book);
        console.log(existing);
        if (existing != null){
            return {
                statusCode: 200,
                body: JSON.stringify("Relationship already exists")
            };
        } else {
            const relationship = await graph.addE('has-read').from_(reader).to(book);
            await driverConnection.close();
            const output = { relationships: relationship}
            console.log(output);
            return {
                statusCode: 200,
                body: JSON.stringify(output)
            };
        }
        
    } catch (e) {
        await driverConnection.close();
        console.log(e);
        return {
            statusCode: 500,
            body: JSON.stringify(e)
        };
    }
};