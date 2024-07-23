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
        const readerId = reader.value;

        const readBooks = await graph.V(readerId)
            .outE("has-read")
            .inV()
            .valueMap(true)
            .by(statics.unfold())
            .toList();

        console.log("============================");
        console.log(readBooks);
        console.log("============================");

        const allBooks = await graph.V(readerId)          // Start from a specific reader vertex
            .outE("has-read")                                     // Find all books this reader has read
            .in_("has-read")                                     // Find other readers of these same books
            .outE("has-read")                                     // Find books read by these other readers
            .inV()
            .valueMap(true)
            .by(statics.unfold())
            .toList();
        
        console.log("============================");
        console.log(allBooks);
        console.log("============================");
    
        //    .where(P.neq(readerId))                            // Exclude the original reader
        //    .outE("has-read")                                     // Find books read by these other readers
        //    .where(P.not(__.in_("has-read").hasId(readerId))) // Exclude books already read by the original reader
        //    .dedup()                                             // Remove duplicates
        //    .valueMap()                                          // Fetch properties of these recommended books
        //    .toList();                                           // Collect the results into a list

        //console.log(readBooks);

        await driverConnection.close();
        return {
            statusCode: 200,
            body: JSON.stringify(allBooks),
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