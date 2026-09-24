import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

/** True once we've confirmed connectivity; defaults to true so the UI doesn't flash offline on mount. */
export function useNetworkStatus(): boolean {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    return NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected !== false);
    });
  }, []);

  return isConnected;
}
