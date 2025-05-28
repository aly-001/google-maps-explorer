export interface BusinessInfo {
  name: string;
  address?: string;
  phone?: string;
  website?: string;
  description?: string;
  hours?: any; // Can be a string or a more structured object
  coordinates?: { lat: number; lng: number };
  screenshot?: string;
  imageUrl?: string;
  research?: any; // Define structure if known, e.g., { status: string; data: string; }
  apollo?: any;   // Define structure if known, e.g., { status: string; hasData: boolean; }
  googlePlaceId?: string;
} 