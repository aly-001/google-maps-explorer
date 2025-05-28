import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { BusinessInfo } from './types/business';

let supabase: SupabaseClient | null = null;

export const initSupabase = async (): Promise<SupabaseClient | null> => {
  // Access environment variables exposed from preload.ts
  const envVars = await window.electron?.env?.getVars();
  const supabaseUrl = envVars?.SUPABASE_URL;
  const supabaseAnonKey = envVars?.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase URL or Anon Key is missing. Make sure they are set in .env and exposed in preload.ts');
    return null;
  }

  if (!supabase) {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  }
  return supabase;
};

const getSupabaseClient = async (): Promise<SupabaseClient> => {
  if (!supabase) {
    // Attempt to initialize if not already done.
    // This provides a fallback but explicit initialization via initSupabase() is preferred.
    console.warn("Supabase client accessed before explicit initialization. Attempting to initialize now.");
    await initSupabase();
    if (!supabase) {
      throw new Error("Failed to initialize Supabase client. Check environment variables and preload script.");
    }
  }
  return supabase;
};

// Save or update a business in the 'current_list' table
export const saveBusinessToSupabase = async (business: BusinessInfo) => {
  const client = await getSupabaseClient();
  try {
    // Map BusinessInfo to your Supabase table structure
    const supabaseData = {
      name: business.name,
      address: business.address,
      phone: business.phone,
      website: business.website,
      description: business.description,
      hours: business.hours,
      coordinates: business.coordinates,
      screenshot: business.screenshot, // Will be null if not provided
      image_url: business.imageUrl,   // Will be null if not provided
      research: business.research,     // Will be null if not provided
      apollo: business.apollo,         // Will be null if not provided
      google_place_id: business.googlePlaceId
    };

    const { data, error } = await client
      .from('current_list') // Using 'current_list' as per your old structure
      .upsert([supabaseData], {
        onConflict: 'name, address', // Assumes name & address form a unique constraint
      });

    if (error) throw error;
    
    console.log('Business saved to Supabase (current_list):', data);
    return { success: true, data };
  } catch (error) {
    console.error('Error saving business to Supabase (current_list):', error);
    return { success: false, error };
  }
};

// Retrieve businesses for map display from 'current_list'
export const getBusinessesForMap = async (): Promise<{ success: boolean; data?: BusinessInfo[]; error?: any }> => {
  const client = await getSupabaseClient();
  console.log('[SupabaseClient] Attempting to fetch businesses for map from current_list...');
  try {
    // First, get the total count
    const { count } = await client
      .from('current_list')
      .select('*', { count: 'exact', head: true })
      .not('coordinates', 'is', null);

    if (!count) {
      console.log('[SupabaseClient] No records found with coordinates');
      return { success: true, data: [] };
    }

    console.log(`[SupabaseClient] Total records with coordinates: ${count}`);

    // Fetch all records in chunks of 1000
    let allData: any[] = [];
    for (let i = 0; i < count; i += 1000) {
      const { data, error, status } = await client
        .from('current_list')
        .select('name, address, coordinates')
        .not('coordinates', 'is', null)
        .range(i, i + 999);

      if (error && status !== 406) {
        console.error('[SupabaseClient] Error fetching chunk:', error);
        throw error;
      }

      if (data) {
        allData = [...allData, ...data];
      }
    }

    console.log(`[SupabaseClient] Retrieved ${allData.length} total records from Supabase before mapping.`);

    const businesses = allData.map(item => ({
      name: item.name,
      address: item.address,
      coordinates: item.coordinates,
    } as BusinessInfo));
    
    console.log(`[SupabaseClient] Mapped to ${businesses.length} business info objects.`);
    return { success: true, data: businesses };
  } catch (error) {
    console.error('[SupabaseClient] Catch block error retrieving businesses for map:', error);
    return { success: false, error };
  }
};

// Retrieve businesses from 'current_list' on or after a specific date
export const getBusinessesFromDate = async (dateString: string): Promise<{ success: boolean; data?: BusinessInfo[]; error?: any }> => {
  const client = await getSupabaseClient();
  console.log(`[SupabaseClient] Attempting to fetch businesses from current_list on or after date: ${dateString}`);
  try {
    // Convert YYYY-MM-DD to a full ISO string for the beginning of that day in UTC
    // Supabase typically stores timestamps in UTC.
    const startDate = `${dateString}T00:00:00.000Z`;

    const { data, error, status, count } = await client
      .from('current_list')
      .select('name, address, phone, website, coordinates') // Select fields needed for export
      .gte('created_at', startDate); // Corrected to created_at as per user confirmation

    console.log('[SupabaseClient] Raw response from Supabase for date query:', { data, error, status, count });

    if (error && status !== 406) { 
      console.error('[SupabaseClient] Error object from Supabase date query:', JSON.stringify(error, null, 2));
      throw error;
    }

    if (!data) {
      console.warn('[SupabaseClient] No data array returned from Supabase for date query, or data is null.');
      return { success: true, data: [] };
    }

    console.log(`[SupabaseClient] Retrieved ${data.length} raw records from Supabase for date query before mapping.`);

    // Map to BusinessInfo. Note: Supabase might return other fields too if not explicitly limited by select.
    // The transform in main.ts will pick what it needs.
    const businesses: BusinessInfo[] = data.map((item: any) => ({
      name: item.name || '',
      address: item.address || null,
      phone: item.phone || null,
      website: item.website || null,
      coordinates: item.coordinates || null,
      // Ensure all fields of BusinessInfo are present, even if null, if your type requires them
      description: null, 
      hours: null,
      screenshot: null,
      imageUrl: null,
      research: null,
      apollo: null,
      googlePlaceId: null,
    } as BusinessInfo));
    
    console.log(`[SupabaseClient] Mapped to ${businesses.length} business info objects for date query.`);
    return { success: true, data: businesses };
  } catch (error) {
    console.error('[SupabaseClient] Catch block error retrieving businesses for date query:', error);
    return { success: false, error };
  }
};

// Retrieve businesses from 'current_list' within a specific timestamp range
// Expects startTimestampString and endTimestampString in a format that can be part of an ISO string (e.g., YYYY-MM-DDTHH:MM)
export const getBusinessesFromDateRange = async (startTimestampString: string, endTimestampString: string): Promise<{ success: boolean; data?: BusinessInfo[]; error?: any }> => {
  const client = await getSupabaseClient();
  console.log(`[SupabaseClient] Attempting to fetch businesses from current_list between ${startTimestampString} and ${endTimestampString}`);
  try {
    // Ensure the input strings are converted to full ISO 8601 UTC timestamps
    // If input is YYYY-MM-DDTHH:MM, append :00.000Z for full UTC timestamp
    // If input already includes seconds or Z, Date constructor should handle it.
    const startDate = new Date(startTimestampString.includes('.') ? startTimestampString : startTimestampString + ':00.000Z').toISOString();
    const endDate = new Date(endTimestampString.includes('.') ? endTimestampString : endTimestampString + ':59.999Z').toISOString(); // End of the specified minute or second

    console.log(`[SupabaseClient] Querying with Start: ${startDate}, End: ${endDate}`);

    const { data, error, status, count } = await client
      .from('current_list')
      .select('name, address, phone, website, coordinates, created_at') 
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: true });

    console.log('[SupabaseClient] Raw response from Supabase for date range query:', { data, error, status, count });

    if (error && status !== 406) { 
      console.error('[SupabaseClient] Error object from Supabase date range query:', JSON.stringify(error, null, 2));
      throw error;
    }

    if (!data) {
      console.warn('[SupabaseClient] No data array returned from Supabase for date range query, or data is null.');
      return { success: true, data: [] };
    }

    console.log(`[SupabaseClient] Retrieved ${data.length} raw records from Supabase for date range query before mapping.`);

    const businesses: BusinessInfo[] = data.map((item: any) => ({
      name: item.name || '',
      address: item.address || null,
      phone: item.phone || null,
      website: item.website || null,
      coordinates: item.coordinates || null,
      description: null, 
      hours: null,
      screenshot: null,
      imageUrl: null,
      research: null,
      apollo: null,
      googlePlaceId: null,
    } as BusinessInfo));
    
    console.log(`[SupabaseClient] Mapped to ${businesses.length} business info objects for date range query.`);
    return { success: true, data: businesses };
  } catch (error) {
    console.error('[SupabaseClient] Catch block error retrieving businesses for date range query:', error);
    return { success: false, error };
  }
}; 