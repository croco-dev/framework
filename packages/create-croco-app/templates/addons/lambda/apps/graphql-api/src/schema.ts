import { GraphQLObjectType, GraphQLSchema, GraphQLString } from "graphql";

export async function createSchema(): Promise<GraphQLSchema> {
  const query = new GraphQLObjectType({
    name: "Query",
    fields: {
      health: {
        type: GraphQLString,
        resolve: () => "ok",
      },
    },
  });

  return new GraphQLSchema({
    query,
  });
}
