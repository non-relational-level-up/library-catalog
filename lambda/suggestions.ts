import { type APIGatewayProxyHandler } from 'aws-lambda';
import { getNeptuneConnection } from '../utils/dbUtils';
import * as gremlin from 'gremlin';

export const handler: APIGatewayProxyHandler = async (event) => {
    const {driverConnection, graph} = getNeptuneConnection();
    const statics = gremlin.process.statics;
    const P = gremlin.process.P;

    try {
        //const output = await graph.V().valueMap().by(statics.unfold()).toList();
        const username = "wandile";
        const reader = await graph.V()
            .hasLabel("Reader")
            .has("username", username)
            .next();

            
        console.log("reader: " + reader);
        console.log("reader.value: " + reader.value);

        const readBooks = await graph.V(reader.value.id)
            .outE("has-read")
            .inV()
            .valueMap(true)
            .by(statics.unfold())
            .toList();

        console.log("============================");
        console.log(readBooks);
        console.log("============================");

        const suggestions = await graph.V(reader.value.id)
            .outE("has-read")
            .inV()
            .aggregate("s")
            .in_("has-read")                 // Move back to reader vertices who have read these same books
            .where(P.neq(reader.value.id))   // Filter out the original reader. We only want other readers.
            .inV()                           // move to subjects (destination nodes/vertices)
            .dedup()                         // remove duplicates
            .valueMap(true)
            .by(statics.unfold())
            .toList();

        console.log(suggestions);

        await driverConnection.close();
        return {
            statusCode: 200,
            body: JSON.stringify(suggestions),
        };
    } 
    
    catch (e) {
        await driverConnection.close();
        console.log(e);
        return {
            statusCode: 500,
            body: JSON.stringify(e)
        };
    }
};