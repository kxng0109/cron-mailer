import { BadRequestException, Logger } from '@nestjs/common';

export function assertDefined<T>(val: T, msg?: string): asserts val is NonNullable<T> {
	const logger = new Logger(assertDefined.name);
	//Tell TS that val is of type T if no error is thrown

	if (val == null || val == undefined) {
		//If val is undefined or null, throw an error
		const errorMessage = msg || `${val} is not defined.`
		logger.error(errorMessage)
		throw new BadRequestException(errorMessage);
	}
}
