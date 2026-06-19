import { create } from 'zustand';
import type { PublishAccount } from '../lib/electron-api';

interface PublishState {
  accounts: PublishAccount[];
  loadAccounts: () => Promise<void>;
}

export const usePublishStore = create<PublishState>((set) => ({
  accounts: [],
  loadAccounts: async () => {
    const accounts = await window.publishAPI.listAccounts();
    set({ accounts });
  },
}));
