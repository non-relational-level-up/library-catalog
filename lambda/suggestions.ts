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
            .valueMap(true)
            .by(statics.unfold())
            .toList();

        console.log(suggestedBooks);

        const suggestedBookDetails = suggestedBooks.map(bookMap => {
            const bookObject: { [key: string]: any } = {};
            Object.entries(bookMap).forEach(([key, value]) => {
                if (typeof key === 'object' && (key as string).constructor.name === 'EnumValue') {
                    bookObject[(key as { elementName: string }).elementName] = value;
                } 
                else {
                    bookObject[key] = value;
                }
            });
            return bookObject;
        });

        console.log("============================");
        console.log(suggestedBookDetails);
        console.log("============================");

        await driverConnection.close();
        return {
            statusCode: 200,
            body: JSON.stringify(suggestedBooks),
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