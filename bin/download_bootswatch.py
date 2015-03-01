#!/usr/bin/env python
import os

import requests

if __name__ == '__main__':
    output_dir = os.path.join(os.path.dirname(__file__), '../vendor/bootswatch')
    manifest = requests.get('http://api.bootswatch.com/3/').json()
    for theme in manifest['themes']:
        slug = theme['name'].lower()
        print 'Downloading', slug
        theme_less = requests.get(theme['less']).content
        variables = requests.get(theme['lessVariables']).content
        if not os.path.exists(os.path.join(output_dir, slug)):
            os.makedirs(os.path.join(output_dir, slug))
        with open(os.path.join(output_dir, slug, 'theme.less'), 'wb') as f:
            f.write(theme_less)
        with open(os.path.join(output_dir, slug, 'variables.less'), 'wb') as f:
            f.write(variables)
