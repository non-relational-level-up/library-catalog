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

        // Suggest books based on similar readers' interests
        const suggestedBooks = await graph.V(readerId)
            .out()                           // Books read by the current reader
            .in_("has-read")                 // Other readers who read the same books
            .out()                           // Books read by these other readers
            .dedup()                         // Remove duplicate books
            .where(__.not(__.in_("has-read").hasId(readerId)))  // Exclude books already read by the current reader
            .limit(3)
            .valueMap(true)
            .by(statics.unfold())
            .toList();

        console.log(suggestedBooks);

        const convertVertexToBook = (vertex: any): any => {
            const book: { [key: string]: any } = {};
            for (const [key, value] of Object.entries(vertex)) {
                if (typeof key === 'object' && key.constructor.name === 'EnumValue') {
                    book[key.elementName] = value;
                } else if (Array.isArray(value) && value.length === 1) {
                    book[key] = value[0];
                } else {
                    book[key] = value;
                }
            }
            return book;
        };

        const suggestedBookObjects = suggestedBooks.map(convertVertexToBook);

        console.log("============================");
        console.log(suggestedBookObjects);
        console.log("============================");

        await driverConnection.close();
        return {
            statusCode: 200,
            body: JSON.stringify(suggestedBookObjects),
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
