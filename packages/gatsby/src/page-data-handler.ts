// app.get(
//   `/page-data/:pagePath(*)/page-data.json`,
//   handlePageData
// );

import path from 'path';

import type { Handler } from 'express';

function reverseFixedPagePath(pageDataRequestPath: string): string {
  return pageDataRequestPath === `index` ? `/` : pageDataRequestPath;
}

const directory = ''; // TODO: fill in project dir

const { GraphQLEngine } = require(path.join(
  directory,
  `.cache`,
  `query-engine`
)); // as typeof import("../schema/graphql-engine/entry")

const { getData, renderPageData } = require(path.join(
  directory,
  `.cache`,
  `page-ssr`
)); // as typeof import("../utils/page-ssr-module/entry")

const graphqlEngine = new GraphQLEngine({
  dbPath: path.join(directory, `.cache`, `data`, `datastore`),
});

// source: gatsby/gatsby::packages/gatsby/src/commands/serve.ts
const handlePageData: Handler = async (req, res, next) => {
  const requestedPagePath = req.params.pagePath;
  if (!requestedPagePath) {
    return void next();
  }

  const potentialPagePath = reverseFixedPagePath(requestedPagePath);
  const page = graphqlEngine.findPageByPath(potentialPagePath);

  if (page && (page.mode === `DSG` || page.mode === `SSR`)) {
    const requestActivity = report.phantomActivity(`request for "${req.path}"`);
    requestActivity.start();
    try {
      const spanContext = requestActivity.span.context();
      const data = await getData({
        pathName: req.path,
        graphqlEngine,
        req,
        spanContext,
      });
      const results = await renderPageData({ data, spanContext });
      if (page.mode === `SSR` && data.serverDataHeaders) {
        for (const [name, value] of Object.entries(data.serverDataHeaders)) {
          res.setHeader(name, value);
        }
      }

      if (page.mode === `SSR` && data.serverDataStatus) {
        return void res.status(data.serverDataStatus).send(results);
      } else {
        return void res.send(results);
      }
    } catch (e) {
      report.error(
        `Generating page-data for "${requestedPagePath}" / "${potentialPagePath}" failed.`,
        e
      );
      return res
        .status(500)
        .contentType(`text/plain`)
        .send(`Internal server error.`);
    } finally {
      requestActivity.end();
    }
  }

  return void next();
};

export default handlePageData;
