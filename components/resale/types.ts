// Tipos leves para os tiles de revenda — não reaproveitam CourseCardData
// (moldado ao catálogo: rating/lessonCount/instructorName, Course.price)
// porque aqui o preço é o do revendedor, não o do curso, e um bundle não
// tem thumbnail/rating próprio.
export interface ResaleListingCardData {
  id: string;
  price: number;
  courseSlug: string;
  courseTitle: string;
  courseThumbnailUrl: string | null;
  courseCategory: string;
  courseLevel: string;
  sellerId: string;
  sellerName: string;
}

export interface ResaleBundleCardData {
  id: string;
  name: string;
  coverImageUrl: string | null;
  price: number;
  listingCount: number;
  courseTitles: string[];
  sellerId: string;
  sellerName: string;
}
