export class FeedbackResponseDto {
  id: string;
  appointmentId: string;
  storeId: string;
  customerId?: string | null;
  staffId?: string | null;
  serviceId?: string | null;
  overallRating: number;
  serviceRating?: number | null;
  staffRating?: number | null;
  cleanlinessRating?: number | null;
  valueRating?: number | null;
  comment?: string | null;
  storeResponse?: string | null;
  respondedAt?: Date | null;
  respondedBy?: string | null;
  isPublic: boolean;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class FeedbackWithDetailsDto extends FeedbackResponseDto {
  customer?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    avatar?: string | null;
  };
  staff?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
  };
  service?: {
    id: string;
    name: string;
  };
}

export class FeedbackStatsDto {
  totalFeedback: number;
  averageOverallRating: number;
  averageServiceRating?: number;
  averageStaffRating?: number;
  averageCleanlinessRating?: number;
  averageValueRating?: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}
