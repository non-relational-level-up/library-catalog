import {type APIGatewayProxyHandler} from 'aws-lambda';
import {getNeptuneConnection} from '../utils/dbUtils';
import * as gremlin from 'gremlin';

export const handler: APIGatewayProxyHandler = async (event) => {
    const {driverConnection, graph} = getNeptuneConnection();
    const statics = gremlin.process.statics;

    try {
        const readerId = event.pathParameters?.readerId;
        const books = await graph.V(readerId)
                .out()
                .hasLabel('Book')
                .out()
                .hasLabel('Series')
                .in_()
                .hasLabel('Book')
                .where(statics
                    .not(statics
                        .in_("has-read")
                        .hasId(readerId)
                    )
                )
                .dedup()
                .order()
                .by('publicationYear')
                .limit(3)
                .values('title')
                .toList();
        await driverConnection.close();
        const output = { suggestions: books}
        console.log(output);
        return {
            statusCode: 200,
            body: JSON.stringify(output)
        };
    } catch (e) {
        await driverConnection.close();
        console.log(e);
        return {
            statusCode: 500,
            body: JSON.stringify(e)
        };
    }
};
