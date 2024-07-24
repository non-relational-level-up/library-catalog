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
        await driverConnection.close();

        return {
            statusCode: 200,
            body: JSON.stringify({ books }),
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