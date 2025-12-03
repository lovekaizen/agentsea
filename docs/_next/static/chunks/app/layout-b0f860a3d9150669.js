(self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([
  [177],
  {
    397: (e, l, s) => {
      (Promise.resolve().then(s.bind(s, 1275)),
        Promise.resolve().then(s.t.bind(s, 7074, 23)),
        Promise.resolve().then(s.t.bind(s, 1290, 23)),
        Promise.resolve().then(s.t.bind(s, 4751, 23)));
    },
    1275: (e, l, s) => {
      'use strict';
      s.d(l, { default: () => t });
      var r = s(5155),
        a = s(5239),
        i = s(2619),
        n = s.n(i),
        o = s(63);
      let c = [
        {
          title: 'Getting Started',
          links: [
            { href: '/', label: 'Home' },
            { href: '/docs', label: 'Documentation' },
            { href: '/docs/installation', label: 'Installation' },
            { href: '/docs/quick-start', label: 'Quick Start' },
            { href: '/docs/cli', label: 'CLI Tool' },
          ],
        },
        {
          title: 'Core Concepts',
          links: [
            { href: '/docs/agents', label: 'Agents' },
            { href: '/docs/providers', label: 'Providers' },
            { href: '/docs/local-providers', label: 'Local Providers' },
            { href: '/docs/tools', label: 'Tools' },
            { href: '/docs/workflows', label: 'Workflows' },
            { href: '/docs/memory', label: 'Memory' },
            { href: '/docs/formatting', label: 'Content Formatting' },
            { href: '/docs/conversation', label: 'Conversation' },
          ],
        },
        {
          title: 'Features',
          links: [
            { href: '/docs/voice', label: 'Voice (TTS/STT)' },
            { href: '/docs/local-models', label: 'Local Models' },
            { href: '/docs/acp-integration', label: 'ACP Commerce' },
            { href: '/api', label: 'REST API & Streaming' },
          ],
        },
        {
          title: 'MCP Integration',
          links: [
            { href: '/docs/mcp-overview', label: 'Overview' },
            { href: '/docs/mcp-servers', label: 'MCP Servers' },
          ],
        },
        {
          title: 'Advanced',
          links: [
            { href: '/docs/multi-tenancy', label: 'Multi-Tenancy' },
            { href: '/docs/observability', label: 'Observability' },
            { href: '/docs/nestjs', label: 'NestJS Integration' },
          ],
        },
        {
          title: 'Resources',
          links: [{ href: '/examples', label: 'Examples' }],
        },
      ];
      function t(e) {
        let { children: l } = e,
          s = (0, o.usePathname)();
        return (0, r.jsxs)('div', {
          className: 'drawer lg:drawer-open',
          children: [
            (0, r.jsx)('input', {
              id: 'main-drawer',
              type: 'checkbox',
              className: 'drawer-toggle',
            }),
            (0, r.jsxs)('div', {
              className: 'drawer-content flex flex-col',
              children: [
                (0, r.jsxs)('div', {
                  className: 'navbar',
                  children: [
                    (0, r.jsx)('div', {
                      className: 'flex-none lg:hidden',
                      children: (0, r.jsx)('label', {
                        htmlFor: 'main-drawer',
                        className: 'btn btn-square btn-ghost',
                        children: (0, r.jsx)('svg', {
                          xmlns: 'http://www.w3.org/2000/svg',
                          fill: 'none',
                          viewBox: '0 0 24 24',
                          className: 'inline-block w-6 h-6 stroke-current',
                          children: (0, r.jsx)('path', {
                            strokeLinecap: 'round',
                            strokeLinejoin: 'round',
                            strokeWidth: '2',
                            d: 'M4 6h16M4 12h16M4 18h16',
                          }),
                        }),
                      }),
                    }),
                    (0, r.jsx)('div', {
                      className: 'flex-1',
                      children: (0, r.jsx)(n(), {
                        href: '/',
                        className: 'btn btn-ghost px-0 py-6',
                        children: (0, r.jsx)(a.default, {
                          src: '/agentsea-sdk-logo.svg',
                          width: 217,
                          height: 60,
                          alt: 'AgentSea Logo',
                        }),
                      }),
                    }),
                    (0, r.jsx)('div', {
                      className: 'flex-none',
                      children: (0, r.jsx)('a', {
                        href: 'https://github.com/lovekaizen/agentsea',
                        target: '_blank',
                        rel: 'noopener noreferrer',
                        className: 'btn btn-ghost btn-circle',
                        title: 'AgentSea on Github',
                        children: (0, r.jsx)('svg', {
                          xmlns: 'http://www.w3.org/2000/svg',
                          width: '24',
                          height: '24',
                          viewBox: '0 0 24 24',
                          fill: 'currentColor',
                          children: (0, r.jsx)('path', {
                            d: 'M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z',
                          }),
                        }),
                      }),
                    }),
                  ],
                }),
                (0, r.jsx)('main', { className: 'flex-1', children: l }),
                (0, r.jsxs)('footer', {
                  className:
                    'footer footer-center bg-base-200 text-base-content p-10',
                  children: [
                    (0, r.jsxs)('nav', {
                      className: 'grid grid-flow-col gap-4',
                      children: [
                        (0, r.jsx)(n(), {
                          href: '/docs/voice',
                          className: 'link link-hover',
                          children: 'Voice Features',
                        }),
                        (0, r.jsx)(n(), {
                          href: '/docs/local-models',
                          className: 'link link-hover',
                          children: 'Local Models',
                        }),
                        (0, r.jsx)(n(), {
                          href: '/docs/cli',
                          className: 'link link-hover',
                          children: 'CLI Tool',
                        }),
                        (0, r.jsx)(n(), {
                          href: '/api',
                          className: 'link link-hover',
                          children: 'REST API',
                        }),
                      ],
                    }),
                    (0, r.jsxs)('nav', {
                      className: 'grid grid-flow-col gap-4',
                      children: [
                        (0, r.jsx)('a', {
                          href: 'https://github.com/lovekaizen/agentsea',
                          className: 'link link-hover',
                          children: 'GitHub',
                        }),
                        (0, r.jsx)('a', {
                          href: 'https://github.com/lovekaizen/agentsea/discussions',
                          className: 'link link-hover',
                          children: 'Discussions',
                        }),
                        (0, r.jsx)('a', {
                          href: 'https://github.com/lovekaizen/agentsea/issues',
                          className: 'link link-hover',
                          children: 'Issues',
                        }),
                      ],
                    }),
                    (0, r.jsx)('aside', {
                      children: (0, r.jsx)('p', {
                        children: '\xa9 2025 AgentSea ADK. MIT License.',
                      }),
                    }),
                  ],
                }),
              ],
            }),
            (0, r.jsxs)('div', {
              className: 'drawer-side border border-r-1 border-y-0 border-l-0',
              children: [
                (0, r.jsx)('label', {
                  htmlFor: 'main-drawer',
                  className: 'drawer-overlay',
                }),
                (0, r.jsx)('aside', {
                  className: 'bg-base-200 min-h-full w-80',
                  children: (0, r.jsx)('ul', {
                    className: 'menu p-4',
                    children: c.map((e, l) =>
                      (0, r.jsxs)(
                        'li',
                        {
                          children: [
                            (0, r.jsx)('h2', {
                              className: 'menu-title',
                              children: e.title,
                            }),
                            (0, r.jsx)('ul', {
                              children: e.links.map((e) =>
                                (0, r.jsx)(
                                  'li',
                                  {
                                    className: 'pl-2',
                                    children: (0, r.jsx)(n(), {
                                      href: e.href,
                                      className:
                                        s === e.href
                                          ? 'active !active:text-white'
                                          : 'active:text-white',
                                      children: e.label,
                                    }),
                                  },
                                  e.href,
                                ),
                              ),
                            }),
                          ],
                        },
                        l,
                      ),
                    ),
                  }),
                }),
              ],
            }),
          ],
        });
      }
    },
    1290: () => {},
    4751: () => {},
  },
  (e) => {
    (e.O(0, [908, 741, 960, 619, 543, 441, 255, 358], () => e((e.s = 397))),
      (_N_E = e.O()));
  },
]);
