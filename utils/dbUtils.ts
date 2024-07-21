import * as gremlin from 'gremlin';

export const getNeptuneConnection = () => {
    const DriverRemoteConnection = gremlin.driver.DriverRemoteConnection;
    const Graph = gremlin.structure.Graph;

    const dc = new DriverRemoteConnection(`wss://${process.env['DB_ADDRESS']}/gremlin`, {});

    const graph = new Graph();
    const g = graph.traversal().withRemote(dc);
    return {driverConnection: dc, graph: g};
};
