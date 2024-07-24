import { type APIGatewayProxyHandler } from 'aws-lambda';
import { getNeptuneConnection } from '../utils/dbUtils';
import * as gremlin from 'gremlin';

export const handler: APIGatewayProxyHandler = async (event) => {
    const { driverConnection, graph } = getNeptuneConnection();
    const statics = gremlin.process.statics;
    const ageGroup = event.pathParameters?.ageGroup || '';

    if (!ageGroup) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: 'Age group parameter is required' }),
        };
    }

    try {
        const books = await graph.V()
            .hasLabel("AgeGroup")
            .has("ageGroup", ageGroup)
            .in_("suitable-for")
            .dedup()
            .limit(3)
            .project("title", "publicationYear")
            .by("title")
            .by("publicationYear")
            .toList();

        console.log(`Books suitable for age group ${ageGroup}:`);
        console.log(books);


        const jsonBooks = books.reduce((acc: any[], book: any) => {
            const obj: { [key: string]: any } = {};
            book.forEach((value: any, key: any) => {
                obj[key] = value;
            });
            acc.push(obj);
            return acc;
        }, []);
        const titles = books.map((book: any) => book.get("title"));

        console.log("Titles: "+JSON.stringify(titles, null, 2));
        console.log("Titless: "+JSON.stringify(titles, null, 1));

        await driverConnection.close();

        return {
            statusCode: 200,
            body: JSON.stringify(jsonBooks, null, 2),
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
