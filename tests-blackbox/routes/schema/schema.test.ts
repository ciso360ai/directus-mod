import request from 'supertest';
import { getUrl } from '@common/config';
import vendors from '@common/get-dbs-to-test';
import * as common from '@common/index';
import {
	collectionAll,
	collectionM2A,
	collectionM2A2,
	collectionM2M,
	collectionM2M2,
	collectionM2O,
	collectionM2O2,
	collectionO2M,
	collectionO2M2,
	collectionSelf,
	deleteAllCollections,
	junctionM2A,
	junctionM2A2,
	junctionM2M,
	junctionM2M2,
	junctionSelfM2M,
	tempTestCollection,
} from './schema.seed';
import { cloneDeep } from 'lodash';
import { PrimaryKeyType, PRIMARY_KEY_TYPES } from '@common/index';
import { load as loadYaml } from 'js-yaml';
import { version as currentDirectusVersion } from '../../../api/package.json';
import { v4 as uuid } from 'uuid';

describe('Schema Snapshots', () => {
	const snapshotsCacheOriginal: {
		[vendor: string]: any;
	} = {};

	const snapshotsCacheOriginalYaml: {
		[vendor: string]: any;
	} = {};

	const snapshotsCacheEmpty: {
		[vendor: string]: any;
	} = {};

	describe('GET /schema/snapshot', () => {
		common.DisableTestCachingSetup();

		describe('denies non-admin users', () => {
			it.each(vendors)('%s', async (vendor) => {
				// Action
				const response = await request(getUrl(vendor))
					.get('/schema/snapshot')
					.set('Authorization', `Bearer ${common.USER.APP_ACCESS.TOKEN}`);
				const response2 = await request(getUrl(vendor))
					.get('/schema/snapshot')
					.set('Authorization', `Bearer ${common.USER.API_ONLY.TOKEN}`);
				const response3 = await request(getUrl(vendor))
					.get('/schema/snapshot')
					.set('Authorization', `Bearer ${common.USER.NO_ROLE.TOKEN}`);

				// Assert
				expect(response.statusCode).toEqual(403);
				expect(response2.statusCode).toEqual(403);
				expect(response3.statusCode).toEqual(403);
			});
		});

		describe('retrieves a snapshot (JSON)', () => {
			it.each(vendors)(
				'%s',
				async (vendor) => {
					// Action
					const response = await request(getUrl(vendor))
						.get('/schema/snapshot')
						.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`);

					// Assert
					expect(response.statusCode).toEqual(200);

					snapshotsCacheOriginal[vendor] = response.body.data;
				},
				300000
			);
		});

		describe('retrieves a snapshot (YAML)', () => {
			it.each(vendors)(
				'%s',
				async (vendor) => {
					// Action
					const response = await request(getUrl(vendor))
						.get('/schema/snapshot')
						.query({ export: 'yaml' })
						.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`);

					// Assert
					expect(response.statusCode).toEqual(200);

					snapshotsCacheOriginalYaml[vendor] = response.text;
				},
				300000
			);
		});

		describe('remove tables', () => {
			describe.each(common.PRIMARY_KEY_TYPES)('%s primary keys', (pkType) => {
				it.each(vendors)(
					'%s',
					async (vendor) => {
						for (const setDefaultValues of [false, true]) {
							// Delete existing collections
							await deleteAllCollections(vendor, pkType, setDefaultValues);
						}

						await assertCollectionsDeleted(vendor, pkType);
					},
					1200000
				);
			});
		});
	});

	common.ClearCaches();

	describe('retrieves empty snapshot', () => {
		it.each(vendors)(
			'%s',
			async (vendor) => {
				// Action
				const response = await request(getUrl(vendor))
					.get('/schema/snapshot')
					.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`);

				// Assert
				expect(response.statusCode).toEqual(200);
				expect(snapshotsCacheEmpty[vendor]).not.toEqual(snapshotsCacheOriginal[vendor]);

				snapshotsCacheEmpty[vendor] = response.body.data;
			},
			300000
		);
	});

	describe('POST /schema/diff', () => {
		describe('denies non-admin users', () => {
			it.each(vendors)('%s', async (vendor) => {
				// Action
				const currentVendor = vendor.replace(/[0-9]/g, '');
				const response = await request(getUrl(vendor))
					.post('/schema/diff')
					.send({
						version: 1,
						directus: currentDirectusVersion,
						vendor: currentVendor,
						collections: [],
						fields: [],
						relations: [],
					})
					.set('Content-type', 'application/json')
					.set('Authorization', `Bearer ${common.USER.APP_ACCESS.TOKEN}`);
				const response2 = await request(getUrl(vendor))
					.post('/schema/diff')
					.send({
						version: 1,
						directus: currentDirectusVersion,
						vendor: currentVendor,
						collections: [],
						fields: [],
						relations: [],
					})
					.set('Content-type', 'application/json')
					.set('Authorization', `Bearer ${common.USER.API_ONLY.TOKEN}`);
				const response3 = await request(getUrl(vendor))
					.post('/schema/diff')
					.send({
						version: 1,
						directus: currentDirectusVersion,
						vendor: currentVendor,
						collections: [],
						fields: [],
						relations: [],
					})
					.set('Content-type', 'application/json')
					.set('Authorization', `Bearer ${common.USER.NO_ROLE.TOKEN}`);

				// Assert
				expect(response.statusCode).toEqual(403);
				expect(response2.statusCode).toEqual(403);
				expect(response3.statusCode).toEqual(403);
			});
		});

		describe('returns diffs with empty snapshot', () => {
			it.each(vendors)(
				'%s',
				async (vendor) => {
					// Action
					const response = await request(getUrl(vendor))
						.post('/schema/diff')
						.send(snapshotsCacheEmpty[vendor])
						.set('Content-type', 'application/json')
						.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`);

					expect(response.statusCode).toEqual(204);
				},
				300000
			);
		});

		describe('returns diffs with original snapshot', () => {
			it.each(vendors)(
				'%s',
				async (vendor) => {
					// Setup
					const collectionsCount =
						snapshotsCacheOriginal[vendor].collections.length - snapshotsCacheEmpty[vendor].collections.length;
					const fieldsCount = snapshotsCacheOriginal[vendor].fields.length - snapshotsCacheEmpty[vendor].fields.length;
					const relationsCount =
						snapshotsCacheOriginal[vendor].relations.length - snapshotsCacheEmpty[vendor].relations.length;

					// Action
					const response = await request(getUrl(vendor))
						.post('/schema/diff')
						.send(snapshotsCacheOriginal[vendor])
						.set('Content-type', 'application/json')
						.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`);

					// Assert
					expect(response.statusCode).toEqual(200);
					expect(response.body.data?.diff?.collections?.length).toBe(collectionsCount);
					expect(response.body.data?.diff?.fields?.length).toBe(fieldsCount);
					expect(response.body.data?.diff?.relations?.length).toBe(relationsCount);
				},
				300000
			);
		});
	});

	describe('POST /schema/apply', () => {
		describe('denies non-admin users', () => {
			it.each(vendors)('%s', async (vendor) => {
				// Action
				const response = await request(getUrl(vendor))
					.post('/schema/apply')
					.send({ data: true })
					.set('Content-type', 'application/json')
					.set('Authorization', `Bearer ${common.USER.APP_ACCESS.TOKEN}`);
				const response2 = await request(getUrl(vendor))
					.post('/schema/apply')
					.send({ data: true })
					.set('Content-type', 'application/json')
					.set('Authorization', `Bearer ${common.USER.API_ONLY.TOKEN}`);
				const response3 = await request(getUrl(vendor))
					.post('/schema/apply')
					.send({ data: true })
					.set('Content-type', 'application/json')
					.set('Authorization', `Bearer ${common.USER.NO_ROLE.TOKEN}`);

				// Assert
				expect(response.statusCode).toEqual(403);
				expect(response2.statusCode).toEqual(403);
				expect(response3.statusCode).toEqual(403);
			});
		});

		describe('applies a snapshot (JSON)', () => {
			it.each(vendors)(
				'%s',
				async (vendor) => {
					expect(snapshotsCacheOriginal[vendor]).toBeDefined();

					// Action
					const responseDiff = await request(getUrl(vendor))
						.post('/schema/diff')
						.send(snapshotsCacheOriginal[vendor])
						.set('Content-type', 'application/json')
						.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`);

					const response = await request(getUrl(vendor))
						.post('/schema/apply')
						.send(responseDiff.body.data)
						.set('Content-type', 'application/json')
						.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`);

					// Assert
					expect(response.statusCode).toEqual(204);
				},
				1200000
			);
		});

		describe('retrieves the same snapshot after applying a snapshot (JSON)', () => {
			it.each(vendors)(
				'%s',
				async (vendor) => {
					expect(snapshotsCacheOriginal[vendor]).toBeDefined();

					// Action
					const response = await request(getUrl(vendor))
						.get('/schema/snapshot')
						.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`);

					const curSnapshot = cloneDeep(response.body.data);
					const oldSnapshot = cloneDeep(snapshotsCacheOriginal[vendor]);

					parseSnapshot(vendor, curSnapshot);
					parseSnapshot(vendor, oldSnapshot);

					// Assert
					expect(response.statusCode).toEqual(200);
					expect(curSnapshot).toStrictEqual(oldSnapshot);
				},
				300000
			);
		});

		describe('applies empty snapshot', () => {
			it.each(vendors)(
				'%s',
				async (vendor) => {
					expect(snapshotsCacheEmpty[vendor]).toBeDefined();

					// Action
					const responseDiff = await request(getUrl(vendor))
						.post('/schema/diff')
						.send(snapshotsCacheEmpty[vendor])
						.set('Content-type', 'application/json')
						.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`);

					const response = await request(getUrl(vendor))
						.post('/schema/apply')
						.send(responseDiff.body.data)
						.set('Content-type', 'application/json')
						.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`);

					// Assert
					expect(response.statusCode).toEqual(204);
				},
				1200000
			);
		});

		describe('ensure that tables are removed', () => {
			describe.each(common.PRIMARY_KEY_TYPES)('%s primary keys', (pkType) => {
				it.each(vendors)(
					'%s',
					async (vendor) => {
						await assertCollectionsDeleted(vendor, pkType);
					},
					600000
				);
			});
		});

		describe('applies a snapshot (YAML)', () => {
			it.each(vendors)(
				'%s',
				async (vendor) => {
					expect(snapshotsCacheOriginalYaml[vendor]).toBeDefined();

					// Action
					const responseDiff = await request(getUrl(vendor))
						.post('/schema/diff')
						.attach('file', Buffer.from(snapshotsCacheOriginalYaml[vendor]))
						.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`);

					const response = await request(getUrl(vendor))
						.post('/schema/apply')
						.send(responseDiff.body.data)
						.set('Content-type', 'application/json')
						.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`);

					// Assert
					expect(response.statusCode).toEqual(204);
				},
				1200000
			);
		});

		describe('retrieves the same snapshot after applying a snapshot (YAML)', () => {
			it.each(vendors)(
				'%s',
				async (vendor) => {
					expect(snapshotsCacheOriginalYaml[vendor]).toBeDefined();

					// Action
					const response = await request(getUrl(vendor))
						.get('/schema/snapshot')
						.query({ export: 'yaml' })
						.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`);

					const curSnapshot = await loadYaml(response.text);
					const oldSnapshot = cloneDeep(snapshotsCacheOriginal[vendor]);

					parseSnapshot(vendor, curSnapshot);
					parseSnapshot(vendor, oldSnapshot);

					// Assert
					expect(response.statusCode).toEqual(200);
					expect(curSnapshot).toStrictEqual(oldSnapshot);
				},
				300000
			);
		});

		describe('applies lhs that is not an object', () => {
			it.each(vendors)(
				'%s',
				async (vendor) => {
					expect(snapshotsCacheOriginal[vendor]).toBeDefined();

					// Setup
					for (const pkType of PRIMARY_KEY_TYPES) {
						await request(getUrl(vendor))
							.patch(`/collections/${collectionAll}_${pkType}`)
							.send({ meta: { icon: 'abc', color: '#E35169' } })
							.set('Content-type', 'application/json')
							.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`);
					}

					// Action
					const responseDiff = await request(getUrl(vendor))
						.post('/schema/diff')
						.send(snapshotsCacheOriginal[vendor])
						.set('Content-type', 'application/json')
						.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`);

					const response = await request(getUrl(vendor))
						.post('/schema/apply')
						.send(responseDiff.body.data)
						.set('Content-type', 'application/json')
						.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`);

					// Assert
					expect(response.statusCode).toEqual(204);
				},
				300000
			);
		});

		describe('applies Array type diffs', () => {
			it.each(vendors)(
				'%s',
				async (vendor) => {
					// Setup
					for (const pkType of PRIMARY_KEY_TYPES) {
						const nameField = (
							await request(getUrl(vendor))
								.get(`/fields/${collectionAll}_${pkType}/name`)
								.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`)
						).body.data;

						nameField.meta.translations = [
							{ language: 'en-US', translation: `${pkType} name` },
							{ language: 'nl-NL', translation: `${pkType} naam` },
						];

						await request(getUrl(vendor))
							.patch(`/fields/${collectionAll}_${pkType}/name`)
							.send(nameField)
							.set('Content-type', 'application/json')
							.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`);
					}

					const newSnapshot = (
						await request(getUrl(vendor))
							.get('/schema/snapshot')
							.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`)
					).body.data;

					for (const pkType of PRIMARY_KEY_TYPES) {
						const nameField = (
							await request(getUrl(vendor))
								.get(`/fields/${collectionAll}_${pkType}/name`)
								.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`)
						).body.data;

						nameField.meta.translations = [
							{ language: 'en-US', translation: `${pkType} name` },
							{ language: 'es-ES', translation: `${pkType} nombre` },
							{ language: 'nl-NL', translation: `${pkType} naam` },
						];

						await request(getUrl(vendor))
							.patch(`/fields/${collectionAll}_${pkType}/name`)
							.send(nameField)
							.set('Content-type', 'application/json')
							.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`);
					}

					// Action
					const responseDiff = await request(getUrl(vendor))
						.post('/schema/diff')
						.send(newSnapshot)
						.set('Content-type', 'application/json')
						.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`);

					const response = await request(getUrl(vendor))
						.post('/schema/apply')
						.send(responseDiff.body.data)
						.set('Content-type', 'application/json')
						.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`);

					// Assert
					expect(response.statusCode).toEqual(204);
				},
				300000
			);
		});

		describe('applies with field meta changes', () => {
			it.each(vendors)(
				'%s',
				async (vendor) => {
					// Setup
					for (const pkType of PRIMARY_KEY_TYPES) {
						const fields = (
							await request(getUrl(vendor))
								.get(`/fields/${collectionAll}_${pkType}`)
								.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`)
						).body.data.map((field: any) => {
							return field.field;
						});

						fields.sort();

						const payload = fields.map((field: string, index: number) => {
							return { field, meta: { sort: index + 1 } };
						});

						await request(getUrl(vendor))
							.patch(`/fields/${collectionAll}_${pkType}`)
							.send(payload)
							.set('Content-type', 'application/json')
							.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`);
					}

					const newSnapshot = (
						await request(getUrl(vendor))
							.get('/schema/snapshot')
							.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`)
					).body.data;

					for (const pkType of PRIMARY_KEY_TYPES) {
						const fields = (
							await request(getUrl(vendor))
								.get(`/fields/${collectionAll}_${pkType}`)
								.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`)
						).body.data.map((field: any) => {
							return field.field;
						});

						fields.sort().reverse();

						const payload = fields.map((field: string, index: number) => {
							return { field, meta: { sort: index + 1 } };
						});

						await request(getUrl(vendor))
							.patch(`/fields/${collectionAll}_${pkType}`)
							.send(payload)
							.set('Content-type', 'application/json')
							.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`);
					}

					// Action
					const responseDiff = await request(getUrl(vendor))
						.post('/schema/diff')
						.send(newSnapshot)
						.set('Content-type', 'application/json')
						.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`);

					const response = await request(getUrl(vendor))
						.post('/schema/apply')
						.send(responseDiff.body.data)
						.set('Content-type', 'application/json')
						.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`);

					// Assert
					expect(response.statusCode).toEqual(204);
				},
				300000
			);
		});

		describe('confirm deletion of relational field does not nullify existing relational fields', () => {
			it.each(vendors)(
				'%s',
				async (vendor) => {
					// TODO: Fix cockroachdb requiring schema changes to be applied first when in a transaction
					if (vendor === 'cockroachdb') {
						expect(true).toBe(true);
						return;
					}

					expect(snapshotsCacheOriginal[vendor]).toBeDefined();

					// Setup
					const childrenIDs: Record<string, { id: any; m2o_id: any; o2m_id: any }> = {};
					const tempRelationalField = 'temp_relational';
					for (const pkType of PRIMARY_KEY_TYPES) {
						const item = await common.CreateItem(vendor, {
							collection: `${collectionAll}_${pkType}`,
							item: {
								id: pkType === 'string' ? uuid() : undefined,
								all_id: { id: pkType === 'string' ? uuid() : undefined },
								o2m: [{ id: pkType === 'string' ? uuid() : undefined }],
							},
						});
						childrenIDs[pkType] = { id: item.id, m2o_id: item.all_id, o2m_id: item.o2m[0] };
						await common.CreateFieldM2O(vendor, {
							collection: `${collectionAll}_${pkType}`,
							field: tempRelationalField,
							otherCollection: collectionSelf,
						});
					}

					// Action
					const responseDiff = await request(getUrl(vendor))
						.post('/schema/diff')
						.send(snapshotsCacheOriginal[vendor])
						.set('Content-type', 'application/json')
						.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`);

					const response = await request(getUrl(vendor))
						.post('/schema/apply')
						.send(responseDiff.body.data)
						.set('Content-type', 'application/json')
						.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`);

					// Assert
					expect(response.statusCode).toEqual(204);
					for (const pkType of PRIMARY_KEY_TYPES) {
						const item = (
							await request(getUrl(vendor))
								.get(`/items/${collectionAll}_${pkType}/${childrenIDs[pkType].id}`)
								.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`)
						).body.data;

						expect(item.all_id).toBe(childrenIDs[pkType].m2o_id);
						expect(item.o2m).toHaveLength(1);
						expect(item.o2m[0]).toBe(childrenIDs[pkType].o2m_id);
					}
				},
				300000
			);
		});
	});

	common.ClearCaches();

	describe('Hash Tests', () => {
		describe('with deleted fields', () => {
			it.each(vendors)(
				'%s',
				async (vendor) => {
					expect(snapshotsCacheEmpty[vendor]).toBeDefined();

					// Action
					const responseDiff = await request(getUrl(vendor))
						.post('/schema/diff')
						.send(snapshotsCacheEmpty[vendor])
						.set('Content-type', 'application/json')
						.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`);

					for (const pkType of PRIMARY_KEY_TYPES) {
						await request(getUrl(vendor))
							.delete(`/fields/${collectionSelf}_${pkType}/self_id`)
							.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`);
					}

					const response = await request(getUrl(vendor))
						.post('/schema/apply')
						.send(responseDiff.body.data)
						.set('Content-type', 'application/json')
						.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`);

					// Assert
					expect(response.statusCode).toEqual(400);
					expect(response.text).toContain('Please generate a new diff and try again.');
				},
				1200000
			);
		});

		describe('with new collection', () => {
			it.each(vendors)(
				'%s',
				async (vendor) => {
					expect(snapshotsCacheEmpty[vendor]).toBeDefined();

					// Action
					const responseDiff = await request(getUrl(vendor))
						.post('/schema/diff')
						.send(snapshotsCacheEmpty[vendor])
						.set('Content-type', 'application/json')
						.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`);

					await request(getUrl(vendor))
						.post(`/collections`)
						.send({
							collection: tempTestCollection,
							fields: [
								{
									field: 'id',
									type: 'integer',
									meta: { hidden: true, interface: 'input', readonly: true },
									schema: { is_primary_key: true, has_auto_increment: true },
								},
							],
							schema: {},
							meta: { singleton: false },
						})
						.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`);

					const response = await request(getUrl(vendor))
						.post('/schema/apply')
						.send(responseDiff.body.data)
						.set('Content-type', 'application/json')
						.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`);

					// Assert
					expect(response.statusCode).toEqual(400);
					expect(response.text).toContain('Please generate a new diff and try again.');
				},
				1200000
			);
		});
	});
});

function parseSnapshot(vendor: string, snapshot: any) {
	if (vendor === 'cockroachdb') {
		if (snapshot.fields) {
			for (const field of snapshot.fields) {
				if (
					field.schema?.default_value &&
					['integer', 'bigInteger'].includes(field.type) &&
					typeof field.schema.default_value === 'string' &&
					field.schema.default_value.startsWith('nextval(')
				) {
					field.schema.default_value = field.schema.default_value.replace(
						/(_seq)\d*('::STRING::REGCLASS\))/,
						`_seq'::STRING::REGCLASS)`
					);
				}
			}
		}
	}
}

async function assertCollectionsDeleted(vendor: string, pkType: PrimaryKeyType) {
	for (const setDefaultValues of [false, true]) {
		const suffix = setDefaultValues ? '2' : '';
		const responses = [];

		// Setup
		const localCollectionAll = `${collectionAll}_${pkType}${suffix}`;
		const localCollectionM2M = `${collectionM2M}_${pkType}${suffix}`;
		const localCollectionM2M2 = `${collectionM2M2}_${pkType}${suffix}`;
		const localJunctionAllM2M = `${junctionM2M}_${pkType}${suffix}`;
		const localJunctionM2MM2M2 = `${junctionM2M2}_${pkType}${suffix}`;
		const localCollectionM2A = `${collectionM2A}_${pkType}${suffix}`;
		const localCollectionM2A2 = `${collectionM2A2}_${pkType}${suffix}`;
		const localJunctionAllM2A = `${junctionM2A}_${pkType}${suffix}`;
		const localJunctionM2AM2A2 = `${junctionM2A2}_${pkType}${suffix}`;
		const localCollectionM2O = `${collectionM2O}_${pkType}${suffix}`;
		const localCollectionM2O2 = `${collectionM2O2}_${pkType}${suffix}`;
		const localCollectionO2M = `${collectionO2M}_${pkType}${suffix}`;
		const localCollectionO2M2 = `${collectionO2M2}_${pkType}${suffix}`;
		const localCollectionSelf = `${collectionSelf}_${pkType}${suffix}`;
		const localJunctionSelfM2M = `${junctionSelfM2M}_${pkType}${suffix}`;

		responses.push(
			await request(getUrl(vendor))
				.get(`/items/${localJunctionSelfM2M}`)
				.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`)
		);
		responses.push(
			await request(getUrl(vendor))
				.get(`/items/${localCollectionSelf}`)
				.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`)
		);
		responses.push(
			await request(getUrl(vendor))
				.get(`/items/${localCollectionO2M2}`)
				.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`)
		);
		responses.push(
			await request(getUrl(vendor))
				.get(`/items/${localCollectionO2M}`)
				.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`)
		);
		responses.push(
			await request(getUrl(vendor))
				.get(`/items/${localJunctionM2AM2A2}`)
				.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`)
		);
		responses.push(
			await request(getUrl(vendor))
				.get(`/items/${localJunctionAllM2A}`)
				.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`)
		);
		responses.push(
			await request(getUrl(vendor))
				.get(`/items/${localCollectionM2A2}`)
				.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`)
		);
		responses.push(
			await request(getUrl(vendor))
				.get(`/items/${localCollectionM2A}`)
				.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`)
		);

		responses.push(
			await request(getUrl(vendor))
				.get(`/items/${localJunctionM2MM2M2}`)
				.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`)
		);
		responses.push(
			await request(getUrl(vendor))
				.get(`/items/${localJunctionAllM2M}`)
				.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`)
		);
		responses.push(
			await request(getUrl(vendor))
				.get(`/items/${localCollectionM2M2}`)
				.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`)
		);
		responses.push(
			await request(getUrl(vendor))
				.get(`/items/${localCollectionM2M}`)
				.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`)
		);
		responses.push(
			await request(getUrl(vendor))
				.get(`/items/${localCollectionAll}`)
				.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`)
		);
		responses.push(
			await request(getUrl(vendor))
				.get(`/items/${localCollectionM2O}`)
				.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`)
		);
		responses.push(
			await request(getUrl(vendor))
				.get(`/items/${localCollectionM2O2}`)
				.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`)
		);

		// Assert
		for (const response of responses) {
			expect(response.statusCode).toEqual(403);
		}
	}
}
