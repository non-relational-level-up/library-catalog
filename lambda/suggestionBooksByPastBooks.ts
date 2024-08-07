import { type APIGatewayProxyHandler } from 'aws-lambda';
import { getNeptuneConnection } from '../utils/dbUtils';
import * as gremlin from 'gremlin';

export const handler: APIGatewayProxyHandler = async (event) => {
    const {driverConnection, graph} = getNeptuneConnection();
    const statics = gremlin.process.statics;
    const P = gremlin.process.P;

    const readerId = event.pathParameters?.readerId || '';
    if (!readerId) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: 'Reader id is required' }),
        };
    }

    try {

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
                .where(statics.not(statics.in_("has-read").hasId(readerId)))  // Exclude books already read by the current reader
                .limit(3)
                .project("title")
                .by("title")
                .toList();

        const responseList: any = [];
        const jsonBooks = suggestedBooks.map((book: any) => {
            const obj: { [key: string]: any } = {};
            book.forEach((value: any, key: any) => {
                obj[key] = value;
            });
            return obj;
        });
        
        jsonBooks.forEach((book: any) => {
            responseList.push(book["title"]);
        });

        const output = { suggestions: responseList };
        console.log("Suggested Books:");
        console.log(output);

        await driverConnection.close();
        return {
            statusCode: 200,
            body: JSON.stringify(output),
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
