/*
 * Copyright 2017-2017 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with
 * the License. A copy of the License is located at
 *
 *     http://aws.amazon.com/apache2.0/
 *
 * or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
 * CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions
 * and limitations under the License.
 */

import React, { Component } from 'react';

import {
    Storage,
    Logger,
    Hub,
    ClientDevice,
    JS
} from 'aws-amplify';

import { Picker } from '../Widget';
import AmplifyTheme from '../AmplifyTheme';
import S3Image from './S3Image';
import S3Text from './S3Text';
import { calcKey } from './Common';

const logger = new Logger('Storage.S3Album');

export default class S3Album extends Component {
    constructor(props) {
        super(props);

        this.handlePick = this.handlePick.bind(this);
        this.list = this.list.bind(this);
        this.marshal = this.marshal.bind(this);

        const theme = this.props.theme || AmplifyTheme;
        this.state = {
            theme: theme,
            items: []
        };

        Hub.listen('window', this, 'S3Album');
    }

    getKey(file) {
        const { fileToKey } = this.props;

        const { name, size, type } = file;
        let key = encodeURI(name);
        if (fileToKey) {
            const callback_type = typeof fileToKey;
            if (callback_type === 'string') {
                key = fileToKey;
            } else if (callback_type === 'function') {
                key = fileToKey({ name: name, size: size, type: type });
            } else {
                key = encodeURI(JSON.stringify(fileToKey));
            }
            if (!key) {
                logger.debug('key is empty');
                key = 'empty_key';
            }
        }

        return key.replace(/\s/g, '_');
    }

    handlePick(data) {
        const that = this;

        const path = this.props.path || '';
        const { file, name, size, type } = data;
        const key = path + this.getKey(data);
        Storage.put(key, file, { contentType: type })
            .then(data => {
                logger.debug('handle pick data', data);
                const { items } = this.state;
                if (items.filter(item => item.key === key).length === 0) {
                    const list = items.concat(data);
                    this.marshal(list);
                } else {
                    logger.debug('update an item');
                }
            })
            .catch(err => logger.debug('handle pick error', err));
    }

    onHubCapsule(capsule) {
        const theme = this.props.theme || AmplifyTheme;
        this.setState({ theme: Object.assign({}, theme) });
    }

    componentDidMount() {
        this.list()
            .then(data => {
                this.marshal(data);
            })
            .catch(err => logger.warn(err));
    }

    list() {
        const { path, level } = this.props;
        logger.debug('Album path: ' + path);
        return Storage.list(path, { level: level? level : 'public' })
            .then(data => {
                logger.debug('album list', data);
                return data;
            })
            .catch(err => {
                logger.warn(err);
                return [];
            });
    }

    contentType(item) {
        return JS.filenameToContentType(item.key, 'image/*');
    }

    marshal(list) {
        const contentType = this.props.contentType || this.contentType;
        list.forEach(item => {
            if (item.contentType) { return; }
            const isString = typeof contentType === 'string';
            item.contentType = isString? contentType : contentType(item);
        });

        list = this.filter(list);
        list = this.sort(list);
        this.setState({ items: list });
    }

    filter(list) {
        const { filter } = this.props;
        return filter? filter(list) : list;
    }

    sort(list) {
        const { sort } = this.props;
        const typeof_sort = typeof sort;
        if (typeof_sort === 'function') { return sort(list); }

        if (['string', 'undefined'].includes(typeof_sort)) {
            const sort_str = sort? sort : 'lastModified';
            const parts = sort_str.split(/\s+/);
            const field = parts[0];
            let dir = parts.length > 1? parts[1] : '';
            if (field === 'lastModified') {
                dir = (dir === 'asc')? 'asc' : 'desc';
            } else {
                dir = (dir === 'desc')? 'desc' : 'asc';
            }
            JS.sortByField(list, field, dir);

            return list;
        }

        logger.warn('invalid sort. done nothing. should be a string or function');
        return list;
    }

    render() {
        const { picker } = this.props;
        const { items } = this.state;

        const pickerTitle = this.props.pickerTitle || 'Pick';

        const theme = this.props.theme || AmplifyTheme;

        const list = items.map(item => {
            const isText = item.contentType && JS.isTextFile(item.contentType);
            return isText? <S3Text
                             key={item.key}
                             textKey={item.key}
                             theme={theme}
                             style={theme.albumText}
                           />
                         : <S3Image
                             key={item.key}
                             imgKey={item.key}
                             theme={theme}
                             style={theme.albumPhoto}
                           />
        });
        return (
            <div>
                <div style={theme.album}>
                    {list}
                </div>
                { picker? <Picker
                            key="picker"
                            title={pickerTitle}
                            accept="image/*, text/*"
                            onPick={this.handlePick}
                            theme={theme}
                          />
                        : null
                }
            </div>
        )
    }
}
