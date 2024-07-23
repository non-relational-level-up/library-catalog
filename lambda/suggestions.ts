import { type APIGatewayProxyHandler } from 'aws-lambda';
import { getNeptuneConnection } from '../utils/dbUtils';
import * as gremlin from 'gremlin';
const __ = gremlin.process.statics;

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

            
        console.log("reader: " + JSON.stringify(reader));
        console.log("reader.value: " + reader.value);

        const readBooks = await graph.V(reader.value)
            .outE("has-read")
            .inV()
            .valueMap(true)
            .by(statics.unfold())
            .toList();

        console.log("============================");
        console.log(readBooks);
        console.log("============================");

        const suggestions = await graph.V(reader.value)          // Start from a specific reader vertex
            .out("has-read")                                     // Find all books this reader has read
            .in_("has-read")                                     // Find other readers of these same books
            .where(P.neq(reader.value))                          // Exclude the original reader
            .out("has-read")                                     // Find books read by these other readers
            .where(P.not(__.in_("has-read").hasId(reader.value))) // Exclude books already read by the original reader
            .dedup()                                             // Remove duplicates
            .valueMap()                                          // Fetch properties of these recommended books
            .toList();                                           // Collect the results into a list

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