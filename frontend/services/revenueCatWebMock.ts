/**
 * RevenueCat Web Mock
 * This file provides a mock implementation for web platform
 * where react-native-purchases doesn't work
 */

// Mock CustomerInfo
export interface CustomerInfo {
  entitlements: {
    active: Record<string, any>;
  };
  originalAppUserId: string;
}

// Mock exports matching react-native-purchases
export const LOG_LEVEL = {
  VERBOSE: 'VERBOSE',
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
};

export const PURCHASES_ERROR_CODE = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  PURCHASE_INVALID_ERROR: 'PURCHASE_INVALID_ERROR',
  STORE_PROBLEM_ERROR: 'STORE_PROBLEM_ERROR',
  RECEIPT_ALREADY_IN_USE_ERROR: 'RECEIPT_ALREADY_IN_USE_ERROR',
  INVALID_CREDENTIALS_ERROR: 'INVALID_CREDENTIALS_ERROR',
};

// Mock Purchases class
class MockPurchases {
  static async configure(config: any) {
    console.log('[RevenueCat Web Mock] configure called');
    return Promise.resolve();
  }

  static async logIn(userId: string) {
    console.log('[RevenueCat Web Mock] logIn called');
    return { customerInfo: mockCustomerInfo };
  }

  static async logOut() {
    console.log('[RevenueCat Web Mock] logOut called');
    return Promise.resolve();
  }

  static async getOfferings() {
    console.log('[RevenueCat Web Mock] getOfferings called');
    return null;
  }

  static async getCustomerInfo() {
    console.log('[RevenueCat Web Mock] getCustomerInfo called');
    return mockCustomerInfo;
  }

  static async purchasePackage(pkg: any) {
    console.log('[RevenueCat Web Mock] purchasePackage called');
    return { customerInfo: mockCustomerInfo };
  }

  static async restorePurchases() {
    console.log('[RevenueCat Web Mock] restorePurchases called');
    return mockCustomerInfo;
  }

  static setLogLevel(level: any) {
    console.log('[RevenueCat Web Mock] setLogLevel called');
  }

  static addCustomerInfoUpdateListener(listener: (info: CustomerInfo) => void) {
    console.log('[RevenueCat Web Mock] addCustomerInfoUpdateListener called');
    return () => {};
  }
}

const mockCustomerInfo: CustomerInfo = {
  entitlements: {
    active: {},
  },
  originalAppUserId: 'web-mock-user',
};

export default MockPurchases;
