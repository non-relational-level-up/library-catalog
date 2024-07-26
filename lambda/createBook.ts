import { APIGatewayProxyHandler } from 'aws-lambda';
import { getNeptuneConnection } from '../utils/dbUtils';
import axios from 'axios';

export const handler: APIGatewayProxyHandler = async (event) => {
    const { sparqlEndpoint } = getNeptuneConnection();

    const { title, publicationYear, authorName, genre, series, ageGroup } = JSON.parse(event.body || '{}');

    if (!title || !publicationYear || !authorName || !genre || !series || !ageGroup) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: 'All book details (title, publicationYear, authorName, genre, series, ageGroup) are required' }),
        };
    }

    try {
        // Function to check if a vertex exists
        const checkIfExists = async (label: string, property: string, value: string) => {
            const query = `
                PREFIX ex: <http://example.org/>
                ASK WHERE {
                    ?s a ex:${label} ;
                       ex:${property} "${value}" .
                }
            `;
            const response = await axios.post(sparqlEndpoint, `query=${encodeURIComponent(query)}`, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            });
            return response.data.boolean;
        };

        // Function to insert a vertex
        const insertVertex = async (label: string, properties: { [key: string]: string }) => {
            const propString = Object.entries(properties)
                .map(([key, value]) => `ex:${key} "${value}"`)
                .join(' ; ');
            const query = `
                PREFIX ex: <http://example.org/>
                INSERT DATA {
                    _:new a ex:${label} ;
                         ${propString} .
                }
            `;
            await axios.post(sparqlEndpoint, `update=${encodeURIComponent(query)}`, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            });
        };

        // Function to insert an edge
        const insertEdge = async (fromLabel: string, fromProperty: string, fromValue: string, toLabel: string, toProperty: string, toValue: string, edgeLabel: string) => {
            const query = `
                PREFIX ex: <http://example.org/>
                INSERT {
                    ?from ex:${edgeLabel} ?to .
                }
                WHERE {
                    ?from a ex:${fromLabel} ;
                          ex:${fromProperty} "${fromValue}" .
                    ?to a ex:${toLabel} ;
                        ex:${toProperty} "${toValue}" .
                }
            `;
            await axios.post(sparqlEndpoint, `update=${encodeURIComponent(query)}`, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            });
        };

        if (await checkIfExists('Book', 'title', title)) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'Book already exists' }),
            };
        }

        await insertVertex('Author', { fullName: authorName });
        await insertVertex('Book', { title, publicationYear });
        await insertVertex('Genre', { name: genre });
        await insertVertex('Series', { name: series });
        await insertVertex('AgeGroup', { ageGroup });

        await insertEdge('Author', 'fullName', authorName, 'Book', 'title', title, 'wrote');
        await insertEdge('Book', 'title', title, 'Genre', 'name', genre, 'belongs-to');
        await insertEdge('Book', 'title', title, 'Series', 'name', series, 'part-of');
        await insertEdge('Book', 'title', title, 'AgeGroup', 'ageGroup', ageGroup, 'suitable-for');

        console.log(`Book "${title}" added successfully with details.`);
        
        return {
            statusCode: 200,
            body: JSON.stringify({ message: `Book "${title}" added successfully` }),
        };
    } catch (e) {
        console.log(e);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Internal server error', error: e }),
        };
    }
};
