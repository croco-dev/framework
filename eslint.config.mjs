import base from '@croco/eslint-config';
import { globalIgnores } from "eslint/config";


export default [...base, globalIgnores(["template"])];
