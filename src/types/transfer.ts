export interface DevicePresence {
  id: number;
  user_id: number;
  device_id: string;
  device_name: string;
  last_seen_at: number;
  created_at: number;
}

export interface SignalingMessage {
  id: number;
  user_id: number;
  from_device_id: string;
  to_device_id: string;
  type:
    | 'offer'
    | 'answer'
    | 'ice-candidate'
    | 'transfer-request'
    | 'transfer-accept'
    | 'transfer-reject';
  payload: string;
  created_at: number;
  consumed: number;
}

export interface TransferFileInfo {
  name: string;
  size: number;
  type: string;
}
