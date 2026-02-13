import { UIPlan, VersionRecord } from '@/agent/schema';

// In-memory version store
class VersionStore {
  private versions: VersionRecord[] = [];
  private currentVersionId: string | null = null;

  addVersion(
    plan: UIPlan,
    code: string,
    explanation: string
  ): string {
    const id = `v${Date.now()}`;
    const record: VersionRecord = {
      id,
      plan,
      code,
      explanation,
      timestamp: Date.now(),
    };
    
    this.versions.push(record);
    this.currentVersionId = id;
    
    return id;
  }

  getAllVersions(): VersionRecord[] {
    return this.versions;
  }

  getVersion(id: string): VersionRecord | undefined {
    return this.versions.find(v => v.id === id);
  }

  getCurrentVersion(): VersionRecord | undefined {
    if (!this.currentVersionId) return undefined;
    return this.getVersion(this.currentVersionId);
  }

  setCurrentVersion(id: string): boolean {
    const version = this.getVersion(id);
    if (!version) return false;
    this.currentVersionId = id;
    return true;
  }

  deleteVersion(id: string): boolean {
    const index = this.versions.findIndex(v => v.id === id);
    if (index === -1) return false;
    this.versions.splice(index, 1);
    if (this.currentVersionId === id) {
      this.currentVersionId = this.versions[this.versions.length - 1]?.id || null;
    }
    return true;
  }

  clear(): void {
    this.versions = [];
    this.currentVersionId = null;
  }
}

// Global instance
let store: VersionStore | null = null;

export function getVersionStore(): VersionStore {
  if (!store) {
    store = new VersionStore();
  }
  return store;
}

export function resetVersionStore(): void {
  store = null;
}
