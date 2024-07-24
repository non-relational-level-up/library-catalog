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
                .out("has-read")                 // Books read by the current reader
                .in_("has-read")                 // Other readers who read the same books
                .out("has-read")                 // Books read by these other readers
                .dedup()                         // Remove duplicate books
                .where(__.not(__.in_("has-read").hasId(readerId)))  // Exclude books already read by the current reader
                .limit(3)
                .project("id", "title", "publicationYear")
                .by(__.id())
                .by("title")
                .by(__.in_("wrote").values("name"))
                .toList();

        console.log("Suggested Books:");
        console.log(JSON.stringify(suggestedBooks, null, 2));

        if (suggestedBooks.length === 0) {
            console.log("No suggested books found. Debugging information:");
            const booksReadByUser = await graph.V(readerId).out("has-read").count().next();
            console.log(`Books read by user: ${booksReadByUser.value}`);
            const otherReaders = await graph.V(readerId).out("has-read").in_("has-read").dedup().count().next();
            console.log(`Other readers with similar tastes: ${otherReaders.value}`);
        }

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
