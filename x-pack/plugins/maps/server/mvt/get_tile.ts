/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import _ from 'lodash';
import { Logger } from 'src/core/server';
import type { DataRequestHandlerContext } from 'src/plugins/data/server';
import { DEFAULT_MAX_RESULT_WINDOW, ES_GEO_FIELD_TYPE } from '../../common/constants';

function isAbortError(error: Error) {
  return error.message === 'Request aborted' || error.message === 'Aborted';
}

export async function getEsTile({
  logger,
  context,
  index,
  geometryFieldName,
  x,
  y,
  z,
  requestBody = {},
}: {
  x: number;
  y: number;
  z: number;
  geometryFieldName: string;
  index: string;
  context: DataRequestHandlerContext;
  logger: Logger;
  requestBody: any;
  geoFieldType: ES_GEO_FIELD_TYPE;
}): Promise<Buffer | null> {
  try {
    const path = `/${encodeURIComponent(index)}/_mvt/${geometryFieldName}/${z}/${x}/${y}`;
    let fields = _.uniq(requestBody.docvalue_fields.concat(requestBody.stored_fields));
    fields = fields.filter((f) => f !== geometryFieldName);
    const body = {
      size: DEFAULT_MAX_RESULT_WINDOW,
      grid_precision: 0, // no aggs
      exact_bounds: true,
      extent: 4096, // full resolution,
      query: requestBody.query,
      fields,
      runtime_mappings: requestBody.runtime_mappings,
    };
    const tile = await context.core.elasticsearch.client.asCurrentUser.transport.request({
      method: 'GET',
      path,
      body,
    });
    return (tile.body as unknown) as Buffer;
  } catch (e) {
    if (!isAbortError(e)) {
      // These are often circuit breaking exceptions
      // Should return a tile with some error message
      logger.warn(`Cannot generate ES-grid-tile for ${z}/${x}/${y}: ${e.message}`);
    }
    return null;
  }
}
