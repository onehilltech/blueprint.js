/*
 * Copyright (c) 2018 One Hill Technologies, LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const blueprint = require ('../../../../lib');

module.exports = {
  // using protocols is the legacy method configuring server ports
  connections : {
    insecure : { protocol: 'http', port: 10000 },

    secure : {
      port: 8443,
      protocol: 'https',
      options : {
        key  : blueprint.assetSync ('ssl/dummy.key'),
        cert : blueprint.assetSync ('ssl/dummy.crt')
      }
    }
  },

  middleware : {
    bodyParser : {
      json : { },
      urlencoded : { extended: false }
    }
  }
};
