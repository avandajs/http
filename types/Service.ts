import Filters from "./Filters";
import Datum from "./Datum";

export default  interface Service {
    n: string,//name
    t: 's' | 'c',//type: s- service,c- column
    c?: Array<Service | string>//columns - array of services or columns
    f: string,//function
    a?: string//as/alias
    al?: boolean//auto-link
    ft?: Filters//filter
    pr?: Datum<any>//filter,
    p: number,//service page

}