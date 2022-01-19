/**
 * @license Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import * as path from 'path';
import initStoryshots_ from '@storybook/addon-storyshots';
import {imageSnapshot} from '@storybook/addon-storyshots-puppeteer';

const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;

let initStoryshots = initStoryshots_;

if (process.env.CI && require('os').platform() !== 'darwin') {
  initStoryshots = () => {
    describe('Storyshots', () => {
      it.skip('disabled in travis on non-mac for subtle font rendering issues', () => {
        expect(true).toBe(false);
      });
    });
  };
}

initStoryshots({
  configPath: path.join(__dirname, '../../.storybook'),
  suite: 'Image Storyshots',
  test: imageSnapshot({
    storybookUrl: `http://localhost:${process.env.STORYBOOK_PORT}`,
    beforeScreenshot: async (page, options) => {
      // wait for the webfont request to avoid flakiness with webfont display
      await page.waitForNetworkIdle();

      // `parameters` is defined in each story's default export
      const parameters = options.context.parameters;
      let dimensions = parameters.dimensions || {};
      if (parameters.dimensions === 'auto' || !parameters.dimensions) {
        await page.setViewport({width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT});
        await page.evaluate(() => new Promise(r => window.requestAnimationFrame(r)));
        dimensions = await page.evaluate(() => {
          const elements = [...document.querySelectorAll('#storybook-test-root *')];
          return {
            width: Math.max(...elements.map(el => el.clientWidth)),
            height: Math.max(...elements.map(el => el.clientHeight)),
          };
        });
      }

      let {width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT} = dimensions;
      if (parameters.padding) {
        width += parameters.padding * 2;
        height += parameters.padding * 2;
        await page.evaluate(
          px => (document.getElementById('storybook-test-root').style.padding = `${px}px`),
          parameters.padding
        );
      }

      width = Math.ceil(width);
      height = Math.ceil(height);
      await page.setViewport({width, height});
    },
    getMatchOptions: () => ({
      failureThreshold: process.env.CI ? 0.005 : 0.0015,
      failureThresholdType: 'percent',
      // Slower, but required because images can be larger than the default maxBuffer for child processes
      // which jest-image-snapshot relies on.
      // https://github.com/americanexpress/jest-image-snapshot/issues/210
      runInProcess: true,
    }),
    getScreenshotOptions: () => ({
      fullPage: false,
    }),
  }),
});
