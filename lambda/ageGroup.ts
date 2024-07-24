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
            .project("title", "publicationYear")
            .by("title")
            .by("publicationYear")
            .toList();

        console.log(`Books suitable for age group ${ageGroup}:`);
        console.log(books);

        const suggestedBookDetails = books.map(bookMap => {
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

        await driverConnection.close();

        return {
            statusCode: 200,
            body: JSON.stringify(suggestedBookDetails),
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
