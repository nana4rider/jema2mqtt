import type { Entity } from "@/entity";
import env from "@/env";
import setupMqttDeviceManager from "@/manager/mqttDeviceManager";
import type * as builder from "@/payload/builder";
import {
  buildDevice,
  buildEntity,
  buildOrigin,
  StatusMessage,
} from "@/payload/builder";
import type { JemaAccess } from "@/service/jema";
import initializeMqttClient from "@/service/mqtt";

vi.mock("@/payload/builder", async () => {
  const actual = await vi.importActual<typeof builder>("@/payload/builder");
  return {
    ...actual,
    buildDevice: vi.fn(),
    buildEntity: vi.fn(),
    buildOrigin: vi.fn(),
  };
});

vi.mock("@/service/mqtt", () => ({
  default: vi.fn(),
}));

const mockPublish = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();

  vi.mocked(initializeMqttClient).mockResolvedValue({
    publish: mockPublish,
    taskQueueSize: 0,
    close: vi.fn(),
  });
});

function getMockJemaAccess(): JemaAccess {
  return {
    getMonitor: vi.fn().mockResolvedValue(false),
    setMonitorListener: vi.fn(),
    sendControl: vi.fn(),
  };
}

describe("setupMqttDeviceManager", () => {
  test("初期化で各エンティティのトピックを購読する", async () => {
    const mockEntities = [
      { id: "entity1", domain: "light" },
      { id: "entity2", domain: "switch" },
    ] as Entity[];

    const mockJemas = new Map<string, JemaAccess>([
      ["entity1", getMockJemaAccess()],
      ["entity2", getMockJemaAccess()],
    ]);

    vi.mocked(buildOrigin).mockReturnValue({ origin: "test-origin" });
    vi.mocked(buildDevice).mockReturnValue({ device: "test-device" });
    vi.mocked(buildEntity).mockReturnValue({
      unique_id: "id",
    });

    await setupMqttDeviceManager("test-device-id", mockEntities, mockJemas);

    expect(initializeMqttClient).toHaveBeenCalledExactlyOnceWith(
      [
        "jema2mqtt/test-device-id/entity1/set",
        "jema2mqtt/test-device-id/entity2/set",
      ],
      expect.any(Function),
    );
  });

  test("モニタ信号がfalseのときactive命令を受信すると制御信号を送る", async () => {
    const mockEntities = [{ id: "entity1", domain: "lock" }] as Entity[];

    const mockJemaAccess = getMockJemaAccess();
    vi.mocked(mockJemaAccess.getMonitor).mockResolvedValue(false);
    const mockJemas = new Map<string, JemaAccess>([
      ["entity1", mockJemaAccess],
    ]);

    await setupMqttDeviceManager("test-device-id", mockEntities, mockJemas);

    const handleMessage = vi.mocked(initializeMqttClient).mock.calls[0][1];
    await handleMessage(
      "jema2mqtt/test-device-id/entity1/set",
      StatusMessage.ACTIVE,
    );

    expect(mockJemaAccess.sendControl).toHaveBeenCalledTimes(1);
  });

  test("モニタ信号がfalseのときinactive命令を受信しても制御信号を送らない", async () => {
    const mockEntities = [{ id: "entity1", domain: "lock" }] as Entity[];

    const mockJemaAccess = getMockJemaAccess();
    vi.mocked(mockJemaAccess.getMonitor).mockResolvedValue(false);
    const mockJemas = new Map<string, JemaAccess>([
      ["entity1", mockJemaAccess],
    ]);

    await setupMqttDeviceManager("test-device-id", mockEntities, mockJemas);

    const handleMessage = vi.mocked(initializeMqttClient).mock.calls[0][1];
    await handleMessage(
      "jema2mqtt/test-device-id/entity1/set",
      StatusMessage.INACTIVE,
    );

    expect(mockJemaAccess.sendControl).not.toHaveBeenCalled();
  });

  test("モニタ信号がtrueのときinactive命令を受信すると制御信号を送る", async () => {
    const mockEntities = [{ id: "entity1", domain: "lock" }] as Entity[];

    const mockJemaAccess = getMockJemaAccess();
    vi.mocked(mockJemaAccess.getMonitor).mockResolvedValue(true);
    const mockJemas = new Map<string, JemaAccess>([
      ["entity1", mockJemaAccess],
    ]);

    await setupMqttDeviceManager("test-device-id", mockEntities, mockJemas);

    const handleMessage = vi.mocked(initializeMqttClient).mock.calls[0][1];
    await handleMessage(
      "jema2mqtt/test-device-id/entity1/set",
      StatusMessage.INACTIVE,
    );

    expect(mockJemaAccess.sendControl).toHaveBeenCalledTimes(1);
  });

  test("モニタ信号がtrueのときactive命令を受信しても制御信号を送らない", async () => {
    const mockEntities = [{ id: "entity1", domain: "lock" }] as Entity[];

    const mockJemaAccess = getMockJemaAccess();
    vi.mocked(mockJemaAccess.getMonitor).mockResolvedValue(true);
    const mockJemas = new Map<string, JemaAccess>([
      ["entity1", mockJemaAccess],
    ]);

    await setupMqttDeviceManager("test-device-id", mockEntities, mockJemas);

    const handleMessage = vi.mocked(initializeMqttClient).mock.calls[0][1];
    await handleMessage(
      "jema2mqtt/test-device-id/entity1/set",
      StatusMessage.ACTIVE,
    );

    expect(mockJemaAccess.sendControl).not.toHaveBeenCalled();
  });

  test("受信したメッセージが未登録IDの場合何もしない", async () => {
    const mockEntities = [{ id: "entity1", domain: "lock" }] as Entity[];

    const mockJemaAccess = getMockJemaAccess();
    const mockJemas = new Map<string, JemaAccess>([
      ["entity1", mockJemaAccess],
    ]);

    await setupMqttDeviceManager("test-device-id", mockEntities, mockJemas);

    const handleMessage = vi.mocked(initializeMqttClient).mock.calls[0][1];
    await handleMessage(
      "jema2mqtt/test-device-id/entity99/set",
      StatusMessage.ACTIVE,
    );

    expect(mockJemaAccess.sendControl).not.toHaveBeenCalled();
  });

  test("デバイス検出のメッセージを送信", async () => {
    const mockEntities = [{ id: "entity1", domain: "lock" }] as Entity[];

    const mockJemaAccess = getMockJemaAccess();
    const mockJemas = new Map<string, JemaAccess>([
      ["entity1", mockJemaAccess],
    ]);

    vi.mocked(buildOrigin).mockReturnValue({ origin: "test-origin" });
    vi.mocked(buildDevice).mockReturnValue({ device: "test-device" });
    vi.mocked(buildEntity).mockReturnValue({
      unique_id: "id",
    });

    await setupMqttDeviceManager("test-device-id", mockEntities, mockJemas);

    expect(mockPublish).toHaveBeenLastCalledWith(
      `${env.HA_DISCOVERY_PREFIX}/lock/id/config`,
      JSON.stringify({
        unique_id: "id",
        device: "test-device",
        origin: "test-origin",
      }),
      { qos: 1, retain: true },
    );
  });

  test("状態が変化した場合にpublishが呼び出される", async () => {
    const mockEntities: Entity[] = [
      { id: "entity1", domain: "lock" } as Entity,
    ];

    const mockJemaAccess = getMockJemaAccess();
    const mockJemas = new Map<string, JemaAccess>([
      ["entity1", mockJemaAccess],
    ]);

    await setupMqttDeviceManager("test-device-id", mockEntities, mockJemas);

    const monitorListener = vi.mocked(mockJemaAccess.setMonitorListener).mock
      .calls[0][0];

    monitorListener(true);

    expect(mockPublish).toHaveBeenLastCalledWith(
      "jema2mqtt/test-device-id/entity1/state",
      StatusMessage.ACTIVE,
      { retain: true },
    );
  });
});
