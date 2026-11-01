type MaintenanceRead = { readonly __maintenanceRead: unique symbol };

type MaintenanceDb = { readonly executeRepair: (sql: string) => Promise<unknown> };

async function withMaintenanceRead<T>(capability: MaintenanceRead, callback: (db: MaintenanceDb) => Promise<T>): Promise<T> {
  void capability;
  return callback({ executeRepair: async () => undefined });
}

export { withMaintenanceRead };
