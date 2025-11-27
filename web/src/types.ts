export interface Profile {
  // Basic information
  user_id: string;
  username: string;
  full_name: string;
  title: string;
  followed_by: number;
  follows?: number;
  media_count?: number;
  primaryImage?: string;
  gridImages?: string[];
  country?: string | string[];
  links?: Array<{
    platform: string;
    urls: string[];
  }>;

  // Additional marketing information
  biography?: string;
  engagement_rate?: number;
  engagement_rate_tag?: string;
  collaboration_tier?: string;
  collaborate_brand?: string[];
  account_type?: string;
  willing_to_collaborate?: boolean;
  note_for_brand_collaborate_point?: string[];
  note_for_brand_weak_point?: string[];
  tag_brand?: string[];
  language?: string[];
  age_range?: string;
  interests?: string[];
  field_of_creator?: string[];
  demo_short?: string;
  profile_pic_url?: string;
}
