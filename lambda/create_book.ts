import { type APIGatewayProxyHandler } from 'aws-lambda';
import { getNeptuneConnection } from '../utils/dbUtils';
import * as gremlin from 'gremlin';

export const handler: APIGatewayProxyHandler = async (event) => {
    const { driverConnection, graph } = getNeptuneConnection();
    const statics = gremlin.process.statics;

    const { title, publicationYear, authorName, genre, series, ageGroup } = JSON.parse(event.body || '{}');

    if (!title || !publicationYear || !authorName || !genre || !series || !ageGroup) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: 'All book details (title, publicationYear, authorName, genre, series, ageGroup) are required' }),
        };
    }

    try {
        // Add author vertex
        const authorVertex = await graph.addV('Author')
            .property('fullName', authorName)
            .next();

        // Add book vertex
        const bookVertex = await graph.addV('Book')
            .property('title', title)
            .property('publicationYear', publicationYear)
            .next();

        // Add genre vertex
        const genreVertex = await graph.addV('Genre')
            .property('name', genre)
            .next();

        // Add series vertex
        const seriesVertex = await graph.addV('Series')
            .property('name', series)
            .next();

        // Add age group vertex
        const ageGroupVertex = await graph.addV('AgeGroup')
            .property('ageGroup', ageGroup)
            .next();

        // Create edges
        await graph.V(authorVertex.value.id).as('a')
            .V(bookVertex.value.id).as('b')
            .addE('wrote').from_('a').to('b').next();

        await graph.V(bookVertex.value.id).as('b')
            .V(genreVertex.value.id).as('g')
            .addE('belongs-to').from_('b').to('g').next();

        await graph.V(bookVertex.value.id).as('b')
            .V(seriesVertex.value.id).as('s')
            .addE('part-of').from_('b').to('s').next();

        await graph.V(bookVertex.value.id).as('b')
            .V(ageGroupVertex.value.id).as('ag')
            .addE('suitable-for').from_('b').to('ag').next();

        console.log(`Book "${title}" added successfully with details.`);
        
        await driverConnection.close();

        return {
            statusCode: 200,
            body: JSON.stringify({ message: `Book "${title}" added successfully` }),
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
