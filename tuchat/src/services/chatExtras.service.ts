import axios from 'axios';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const API_URL = "https://tuchat-pl9.onrender.com";

const getToken = async () => {
  if (Platform.OS === 'web') return localStorage.getItem('token');
  return await SecureStore.getItemAsync('token');
};

const authHeaders = async () => {
  const token = await getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const fetchRoomPresence = async (roomId: string) => {
  const headers = await authHeaders();
  const { data } = await axios.get(`${API_URL}/chat/presence/${roomId}`, { headers });
  return data?.presence || [];
};

export const fetchRoomEvents = async (roomId: string) => {
  const headers = await authHeaders();
  const { data } = await axios.get(`${API_URL}/chat/events/${roomId}`, { headers });
  return data?.events || [];
};

export const createRoomEventRequest = async (payload: {
  roomId: string;
  title: string;
  description?: string;
  startsAt: string;
  kind?: string;
}) => {
  const headers = await authHeaders();
  const { data } = await axios.post(`${API_URL}/chat/events`, payload, { headers });
  return data?.event;
};

export const fetchRoomPolls = async (roomId: string) => {
  const headers = await authHeaders();
  const { data } = await axios.get(`${API_URL}/chat/polls/${roomId}`, { headers });
  return data?.polls || [];
};

export const fetchRoomPins = async (roomId: string) => {
  const headers = await authHeaders();
  const { data } = await axios.get(`${API_URL}/chat/pins/${roomId}`, { headers });
  return data?.pins || [];
};

export const createRoomPollRequest = async (payload: {
  roomId: string;
  question: string;
  options: string[];
  multiple?: boolean;
}) => {
  const headers = await authHeaders();
  const { data } = await axios.post(`${API_URL}/chat/polls`, payload, { headers });
  return data?.poll;
};

export const votePollRequest = async (payload: {
  roomId: string;
  pollId: string;
  optionId: string;
}) => {
  const headers = await authHeaders();
  const { data } = await axios.post(`${API_URL}/chat/polls/${payload.pollId}/vote`, {
    roomId: payload.roomId,
    optionId: payload.optionId,
  }, { headers });
  return data?.poll;
};
