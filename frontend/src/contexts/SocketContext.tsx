import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../hooks/useAuth';
import { getAccessToken } from '../api/axios';
import { API_URL } from '../config';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  connectionError: string | null;
}

const SocketContext = createContext<SocketContextType>({ 
  socket: null, 
  isConnected: false,
  connectionError: null 
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      const token = getAccessToken();
      
      const apiUrl: string = API_URL || 'http://localhost:5000/api';
      // Handle both absolute URLs (http://...) and relative URLs (/api)
      let socketUrl: string;
      if (apiUrl.startsWith('http')) {
        // Absolute URL: http://localhost:5000/api -> http://localhost:5000
        socketUrl = apiUrl.replace('/api', '');
      } else {
        // Relative URL: /api -> / (same origin)
        socketUrl = '/';
      }

      const newSocket = io(socketUrl, {
        path: '/ws',
        auth: {
          token: token
        }
      });

      // Connection successful
      newSocket.on('connect', () => {
        console.log('✅ Socket connected successfully:', newSocket.id);
        setIsConnected(true);
        setConnectionError(null);
      });

      // Connection failed
      newSocket.on('connect_error', (error) => {
        console.error('❌ Socket connection error:', error.message);
        setIsConnected(false);
        setConnectionError(error.message);
      });

      // Disconnected
      newSocket.on('disconnect', (reason) => {
        console.log('🔌 Socket disconnected:', reason);
        setIsConnected(false);
      });

      // Reconnection attempt
      newSocket.on('reconnect_attempt', (attemptNumber) => {
        console.log(`🔄 Reconnection attempt #${attemptNumber}`);
      });

      // Reconnected successfully
      newSocket.on('reconnect', (attemptNumber) => {
        console.log(`✅ Reconnected successfully after ${attemptNumber} attempts`);
        setIsConnected(true);
        setConnectionError(null);
      });

      // Reconnection failed
      newSocket.on('reconnect_failed', () => {
        console.error('❌ Reconnection failed');
        setConnectionError('Failed to reconnect to server');
      });

      setSocket(newSocket);

      return () => {
        newSocket.close();
        setIsConnected(false);
      };
    } else {
      if (socket) {
        socket.close();
        setSocket(null);
        setIsConnected(false);
        setConnectionError(null);
      }
    }
  }, [isAuthenticated]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, connectionError }}>
      {children}
    </SocketContext.Provider>
  );
};
