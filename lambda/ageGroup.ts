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
        const allBooks = await graph.V(readerId)
            .out().hasLabel('Book')
            .out().hasLabel('AgeGroup')
            .in_().hasLabel('Book')
            .where(statics.not(statics.in_("has-read").hasId(readerId)))
            .dedup()
            .limit(50)
            .values('title')
            .toList();

        const shuffledBooks = allBooks.sort(() => 0.5 - Math.random());
        const recommendations = shuffledBooks.slice(0, 3);

        const output = { suggestions: recommendations };

        await driverConnection.close();

        return {
            statusCode: 200,
            body: JSON.stringify(output),
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
