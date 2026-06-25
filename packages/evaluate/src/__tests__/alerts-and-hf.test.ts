/**
 * Tests for the newly-implemented alert channels (email/PagerDuty) and the
 * HuggingFace dataset import/export integrations.
 *
 * External boundaries (SMTP via nodemailer, the HF Hub SDK, and HTTP via fetch)
 * are mocked so the suite is deterministic and network-free.
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from 'vitest';

// Mock the optional-import indirection so we can supply fake nodemailer / hub
// modules without installing them.
vi.mock('../utils/optional-import.js', () => ({
  importOptional: vi.fn(),
}));

import { importOptional } from '../utils/optional-import.js';
import { AlertManager } from '../continuous/AlertManager.js';
import { EvalDataset } from '../evaluation/EvalDataset.js';
import { DatasetExporter } from '../datasets/DatasetExporter.js';
import type { AlertNotification } from '../types/index.js';

const importOptionalMock = importOptional as unknown as Mock;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('AlertManager — email channel', () => {
  it('delivers via nodemailer SMTP transport', async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: 'abc' });
    const createTransport = vi.fn().mockReturnValue({ sendMail });
    importOptionalMock.mockResolvedValue({ createTransport });

    const manager = new AlertManager({
      channels: [
        {
          type: 'email',
          to: ['oncall@example.com'],
          from: 'alerts@example.com',
          smtp: { host: 'smtp.example.com', port: 587 },
        },
      ],
      rules: {
        accuracy: { metric: 'accuracy', threshold: 0.8, direction: 'below' },
      },
    });

    const sent = new Promise<AlertNotification>((resolve) =>
      manager.once('notification:sent', resolve),
    );
    manager.check('accuracy', 0.5);
    const notification = await sent;

    expect(notification.success).toBe(true);
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'smtp.example.com', port: 587 }),
    );
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'alerts@example.com',
        to: 'oncall@example.com',
        subject: expect.stringContaining('accuracy'),
      }),
    );
  });

  it('reports failure when nodemailer is not installed', async () => {
    importOptionalMock.mockRejectedValue(new Error('Cannot find module'));

    const manager = new AlertManager({
      channels: [
        { type: 'email', to: ['x@y.z'], smtp: { host: 'smtp.example.com' } },
      ],
      rules: {
        accuracy: { metric: 'accuracy', threshold: 0.8, direction: 'below' },
      },
    });

    const sent = new Promise<AlertNotification>((resolve) =>
      manager.once('notification:sent', resolve),
    );
    manager.check('accuracy', 0.5);
    const notification = await sent;

    expect(notification.success).toBe(false);
    expect(notification.error).toMatch(/nodemailer/);
  });
});

describe('AlertManager — PagerDuty channel', () => {
  it('enqueues an Events API v2 trigger with the routing key', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 202, statusText: 'Accepted' });
    vi.stubGlobal('fetch', fetchMock);

    const manager = new AlertManager({
      channels: [{ type: 'pagerduty', routingKey: 'R123' }],
      rules: {
        latency: { metric: 'latency', threshold: 1000, direction: 'above' },
      },
    });

    const sent = new Promise<AlertNotification>((resolve) =>
      manager.once('notification:sent', resolve),
    );
    manager.check('latency', 5000);
    const notification = await sent;

    expect(notification.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://events.pagerduty.com/v2/enqueue');
    const body = JSON.parse((init as { body: string }).body);
    expect(body.routing_key).toBe('R123');
    expect(body.event_action).toBe('trigger');
    expect(body.payload.severity).toBe('warning');
  });

  it('surfaces a non-OK PagerDuty response as a failed notification', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      }),
    );

    const manager = new AlertManager({
      channels: [{ type: 'pagerduty', apiKey: 'fallback-key' }],
      rules: {
        latency: { metric: 'latency', threshold: 1000, direction: 'above' },
      },
    });

    const sent = new Promise<AlertNotification>((resolve) =>
      manager.once('notification:sent', resolve),
    );
    manager.check('latency', 5000);
    const notification = await sent;

    expect(notification.success).toBe(false);
    expect(notification.error).toMatch(/PagerDuty enqueue failed: 400/);
  });
});

describe('EvalDataset.fromHuggingFace', () => {
  beforeEach(() => {
    delete process.env.HF_TOKEN;
  });

  it('loads and maps rows from the datasets-server API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        rows: [
          { row: { input: 'Q1', output: 'A1' } },
          { row: { input: 'Q2', output: 'A2' } },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const ds = await EvalDataset.fromHuggingFace('owner/dataset', {
      split: 'test',
      limit: 50,
    });

    expect(ds.size).toBe(2);
    const items = ds.getItems();
    expect(items[0].input).toBe('Q1');
    expect(items[0].expectedOutput).toBe('A1');

    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain('dataset=owner%2Fdataset');
    expect(calledUrl).toContain('split=test');
  });

  it('throws on a non-OK datasets-server response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      }),
    );

    await expect(
      EvalDataset.fromHuggingFace('missing/dataset'),
    ).rejects.toThrow(/datasets-server request failed: 404/);
  });
});

describe('DatasetExporter.exportToHuggingFace', () => {
  const pairs = [
    { id: 'p1', prompt: 'Hi', chosen: 'Hello!', rejected: 'meh' },
    { id: 'p2', prompt: 'Bye', chosen: 'Goodbye!', rejected: 'k' },
  ];

  it('creates the repo and uploads data + card via @huggingface/hub', async () => {
    const createRepo = vi.fn().mockResolvedValue(undefined);
    const uploadFiles = vi.fn().mockResolvedValue(undefined);
    importOptionalMock.mockResolvedValue({ createRepo, uploadFiles });

    const exporter = new DatasetExporter();
    const result = await exporter.exportToHuggingFace(pairs, {
      format: 'huggingface',
      formatOptions: { name: 'owner/prefs', token: 'hf_xxx', private: true },
    });

    expect(createRepo).toHaveBeenCalledWith(
      expect.objectContaining({
        repo: { type: 'dataset', name: 'owner/prefs' },
        accessToken: 'hf_xxx',
        private: true,
      }),
    );
    expect(uploadFiles).toHaveBeenCalledTimes(1);
    const uploadArg = uploadFiles.mock.calls[0][0];
    const paths = uploadArg.files.map((f: { path: string }) => f.path);
    expect(paths).toContain('data/train.jsonl');
    expect(paths).toContain('README.md');

    expect(result.url).toBe('https://huggingface.co/datasets/owner/prefs');
    expect(result.itemCount).toBe(2);
  });

  it('requires a token', async () => {
    const exporter = new DatasetExporter();
    await expect(
      exporter.exportToHuggingFace(pairs, {
        format: 'huggingface',
        formatOptions: { name: 'owner/prefs' },
      }),
    ).rejects.toThrow(/token is required/);
  });

  it('tolerates an already-existing repo (409)', async () => {
    const createRepo = vi
      .fn()
      .mockRejectedValue(new Error('Repo already exists'));
    const uploadFiles = vi.fn().mockResolvedValue(undefined);
    importOptionalMock.mockResolvedValue({ createRepo, uploadFiles });

    const exporter = new DatasetExporter();
    const result = await exporter.exportToHuggingFace(pairs, {
      format: 'huggingface',
      formatOptions: { name: 'owner/prefs', token: 'hf_xxx' },
    });

    expect(uploadFiles).toHaveBeenCalledTimes(1);
    expect(result.itemCount).toBe(2);
  });
});
