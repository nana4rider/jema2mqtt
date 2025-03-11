import { Entity } from "@/entity";
import env from "@/env";
import setupMqttDeviceManager from "@/manager/mqttDeviceManager";
import * as builder from "@/payload/builder";
import {
  buildDevice,
  buildEntity,
  buildOrigin,
  StatusMessage,
} from "@/payload/builder";
import { JemaAccess } from "@/service/jema";
import initializeMqttClient from "@/service/mqtt";
import { Mock } from "vitest";

vi.mock("@/payload/builder", async () => {
  const actual = await vi.importActual<typeof builder>("@/payload/builder");
  return {
    ...actual,
    buildDevice: vi.fn(),
    buildEntity: vi.fn(),
    buildOrigin: vi.fn(),
  };
});

const mockBuildOrigin = buildOrigin as Mock<typeof buildOrigin>;
const mockBuildDevice = buildDevice as Mock<typeof buildDevice>;
const mockBuildEntity = buildEntity as Mock<typeof buildEntity>;

vi.mock("@/service/mqtt", () => ({
  default: vi.fn(),
}));

const mockPublish = vi.fn();
const mockSetMonitorListener = vi.fn<JemaAccess["setMonitorListener"]>();
const mockGetMonitor = vi.fn();
const mockSendControl = vi.fn();
const mockInitializeMqttClient = initializeMqttClient as Mock<
  typeof initializeMqttClient
>;

beforeEach(() => {
  vi.resetAllMocks();

  mockInitializeMqttClient.mockResolvedValue({
    publish: mockPublish,
    taskQueueSize: 0,
    addSubscribe: vi.fn(),
    close: vi.fn(),
  });
});

describe("setupMqttDeviceManager", () => {
  test("初期化で各エンティティのトピックを購読する", async () => {
    const mockEntities = [
      { id: "entity1", domain: "light" },
      { id: "entity2", domain: "switch" },
    ] as Entity[];

    const mockJemas = new Map<string, JemaAccess>([
      [
        "entity1",
        {
          getMonitor: mockGetMonitor,
          setMonitorListener: mockSetMonitorListener,
        } as unknown as JemaAccess,
      ],
      [
        "entity2",
        {
          getMonitor: mockGetMonitor,
          setMonitorListener: mockSetMonitorListener,
        } as unknown as JemaAccess,
      ],
    ]);

    mockBuildOrigin.mockReturnValue({ origin: "test-origin" });
    mockBuildDevice.mockReturnValue({ device: "test-device" });
    mockBuildEntity.mockReturnValue({
      unique_id: "id",
    });
    mockGetMonitor.mockResolvedValue(false);

    await setupMqttDeviceManager("test-device-id", mockEntities, mockJemas);

    expect(mockInitializeMqttClient).toHaveBeenCalledWith(
      [
        "jema2mqtt/test-device-id/entity1/set",
        "jema2mqtt/test-device-id/entity2/set",
      ],
      expect.any(Function),
    );
  });

  test("モニタ信号がfalseのときactive命令を受信すると制御信号を送る", async () => {
    const mockEntities = [{ id: "entity1", domain: "lock" }] as Entity[];

    const mockJemas = new Map<string, JemaAccess>([
      [
        "entity1",
        {
          getMonitor: mockGetMonitor,
          sendControl: mockSendControl,
          setMonitorListener: mockSetMonitorListener,
        } as unknown as JemaAccess,
      ],
    ]);

    mockGetMonitor.mockResolvedValue(false);

    await setupMqttDeviceManager("test-device-id", mockEntities, mockJemas);

    const handleMessage = mockInitializeMqttClient.mock.calls[0][1];
    await handleMessage(
      "jema2mqtt/test-device-id/entity1/set",
      StatusMessage.ACTIVE,
    );

    expect(mockSendControl).toHaveBeenCalledTimes(1);
  });

  test("モニタ信号がtrueのときinactive命令を受信すると制御信号を送る", async () => {
    const mockEntities = [{ id: "entity1", domain: "lock" }] as Entity[];

    const mockJemas = new Map<string, JemaAccess>([
      [
        "entity1",
        {
          getMonitor: mockGetMonitor,
          sendControl: mockSendControl,
          setMonitorListener: mockSetMonitorListener,
        } as unknown as JemaAccess,
      ],
    ]);

    mockGetMonitor.mockResolvedValue(true);

    await setupMqttDeviceManager("test-device-id", mockEntities, mockJemas);

    const handleMessage = mockInitializeMqttClient.mock.calls[0][1];
    await handleMessage(
      "jema2mqtt/test-device-id/entity1/set",
      StatusMessage.INACTIVE,
    );

    expect(mockSendControl).toHaveBeenCalledTimes(1);
  });

  test("受信したメッセージが未登録IDの場合何もしない", async () => {
    const mockEntities = [{ id: "entity1", domain: "lock" }] as Entity[];

    const mockJemas = new Map<string, JemaAccess>([
      [
        "entity1",
        {
          getMonitor: mockGetMonitor,
          sendControl: mockSendControl,
          setMonitorListener: mockSetMonitorListener,
        } as unknown as JemaAccess,
      ],
    ]);

    mockGetMonitor.mockResolvedValue(false);

    await setupMqttDeviceManager("test-device-id", mockEntities, mockJemas);

    const handleMessage = mockInitializeMqttClient.mock.calls[0][1];
    await handleMessage(
      "jema2mqtt/test-device-id/entity99/set",
      StatusMessage.ACTIVE,
    );

    expect(mockSendControl).not.toHaveBeenCalled();
  });

  test("デバイス検出のメッセージを送信", async () => {
    const mockEntities = [{ id: "entity1", domain: "lock" }] as Entity[];

    const mockJemas = new Map<string, JemaAccess>([
      [
        "entity1",
        {
          getMonitor: mockGetMonitor,
          setMonitorListener: mockSetMonitorListener,
        } as unknown as JemaAccess,
      ],
    ]);

    mockBuildOrigin.mockReturnValue({ origin: "test-origin" });
    mockBuildDevice.mockReturnValue({ device: "test-device" });
    mockBuildEntity.mockReturnValue({
      unique_id: "id",
    });

    mockGetMonitor.mockResolvedValue(false);

    await setupMqttDeviceManager("test-device-id", mockEntities, mockJemas);

    expect(mockPublish).toHaveBeenCalledWith(
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

    const mockJemas = new Map<string, JemaAccess>([
      [
        "entity1",
        {
          getMonitor: mockGetMonitor,
          setMonitorListener: mockSetMonitorListener,
        } as unknown as JemaAccess,
      ],
    ]);

    mockGetMonitor.mockResolvedValue(false);

    await setupMqttDeviceManager("test-device-id", mockEntities, mockJemas);

    const monitorListener = mockSetMonitorListener.mock.calls[0][0];

    monitorListener(true);

    expect(mockPublish).toHaveBeenCalledWith(
      "jema2mqtt/test-device-id/entity1/state",
      StatusMessage.ACTIVE,
      { retain: true },
    );
  });
});
