import { type APIGatewayProxyHandler } from 'aws-lambda';
import { getNeptuneConnection } from '../utils/dbUtils';
import * as gremlin from 'gremlin';

export const handler: APIGatewayProxyHandler = async (event) => {
    const { driverConnection, graph } = getNeptuneConnection();
    const statics = gremlin.process.statics;
    const readerId = event.pathParameters?.ageGroup || '';

    if (!readerId) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: 'Age group parameter is required' }),
        };
    }

    try {

        const books = await graph.V(readerId).out().hasLabel('Book').out().hasLabel('AgeGroup').in_().hasLabel('Book').where(statics.not(statics.in_("has-read").hasId(readerId))).dedup().limit(3).values('title').toList();

        // const books = await graph.V()
        //     .hasLabel("AgeGroup")
        //     .has("ageGroup", ageGroup)
        //     .in_("suitable-for")
        //     .dedup()
        //     .limit(3)
        //     .project("title", "publicationYear")
        //     .by("title")
        //     .by("publicationYear")
        //     .toList();

        console.log(`Books suitable for age group ${readerId}:`);
        console.log(books);

        const titles = books.map((book: any) => book.get("title"));

        console.log("Titless: "+JSON.stringify(titles, null, 1));

        await driverConnection.close();

        return {
            statusCode: 200,
            body:JSON.stringify(titles, null, 1),
        };
    } catch (e) {
        await driverConnection.close();
        console.log(e);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Internal server error', error: e }),
        };
    }
};