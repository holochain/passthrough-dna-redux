# passthrough-dna

[![Project](https://img.shields.io/badge/project-holochain-blue.svg?style=flat-square)](http://holochain.org/)
[![Chat](https://img.shields.io/badge/chat-chat%2eholochain%2enet-blue.svg?style=flat-square)](https://chat.holochain.net)

[![Twitter Follow](https://img.shields.io/twitter/follow/holochain.svg?style=social&label=Follow)](https://twitter.com/holochain)

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Overview

This DNA exposes some of the HDK API function directly. In this case it is kind of a passthrough letting you call make certain holochain calls (e.g. commit, get_entry, link, get_links etc) without any logic inbetween.
It is intended for testing and experimentation purposes.

## Examples

### Sanity test
Run a sanity test using the passthrough DNA:

``` shell
cd test
npm install
npm run test:stress
```

### UI for manual testing

1. Compile the wasm DNA and run the conductor with it:
``` shell
hc package
holochain -c conductor-config.toml
```
2. In a separate terminal run the UI using simply python web server

``` shell
cd ui
python -m SimpleHTTPServer 8888
```

Now go to `localhost:8888` in a browser and you should see the UI connected to the conductor and be able to make hdk calls.

## License
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

Copyright (C) 2019-2020, Holochain Foundation

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

[http://www.apache.org/licenses/LICENSE-2.0](http://www.apache.org/licenses/LICENSE-2.0)

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
