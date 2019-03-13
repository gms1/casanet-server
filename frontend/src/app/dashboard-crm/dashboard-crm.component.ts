import { Component, OnInit } from '@angular/core';
import {
	Minion,
	SwitchOptions,
	Toggle,
	MinionStatus,
	DeviceKind,
	ColorLight,
	ColorOptions
} from '../../../../backend/src/models/sharedInterfaces';
import { MinionsService } from '../services/minions.service';
import { DevicesService } from '../services/devices.service';
import { DeepCopy } from '../../../../backend/src/utilities/deepCopy';
import swal, { SweetAlertResult } from 'sweetalert2';
import { TranslateService } from '../translate.service';
import { TranslatePipe } from '../translate.pipe';
import { MatDialog, MatDialogConfig } from '@angular/material';

@Component({
	selector: 'app-dashboard-crm',
	templateUrl: './dashboard-crm.component.html',
	styleUrls: ['./dashboard-crm.component.scss']
})
export class DashboardCrmComponent implements OnInit {
	/** Mark to show or not loading animation */
	public dataLoading = true;

	public minions: Minion[] = [];

	// TODO: inject it by angular.
	private translatePipe: TranslatePipe;

	constructor(
		private translateService: TranslateService,
		private minionsService: MinionsService,
		private devicesService: DevicesService
	) {
		this.translatePipe = new TranslatePipe(this.translateService);

		minionsService.minionsFeed.subscribe((minions) => {
			const tempMap = {};
			for (const minion of minions) {
				// create update set.
				this.createUpdateSet(minion);

				// then add it to map...
				if (!tempMap[minion.minionType]) {
					tempMap[minion.minionType] = [];
				}
				tempMap[minion.minionType].push(minion);
			}

			this.minions = []; // minions;

			for (const key of Object.keys(tempMap).sort()) {
				const arr = tempMap[key];
				arr.sort((m1: Minion, m2: Minion) => {
					return m1.name < m2.name ? -1 : 1;
				});
				this.minions.push(...arr);
			}
			// this.minions

			this.dataLoading = false;
		});
		minionsService.retriveMinions();
	}

	ngOnInit() { }

	public createUpdateSet(minion: Minion) {
		minion['updateSet'] = DeepCopy<MinionStatus>(minion.minionStatus);
	}

	public getMinionOnOffStatus(minion: Minion, minionStatus: MinionStatus): SwitchOptions {
		const minionSwitchStatus = minionStatus[minion.minionType] as Toggle;
		return minionSwitchStatus.status;
	}

	public isMinionRecordble(minion: Minion): boolean {
		for (const deviceKind of this.devicesService.devicesKinds) {
			if (deviceKind.brand === minion.device.brand && deviceKind.model === minion.device.model) {
				return deviceKind.isRecordingSupported;
			}
		}
	}

	public getMinionColor(minion: Minion): { dark: string; light: string } {
		const switchStatus = this.getMinionOnOffStatus(minion, minion['updateSet']);

		if (minion.minionType !== 'toggle' && (!switchStatus || switchStatus !== 'on')) {
			return {
				light: '#494a4c',
				dark: '#8c8f93'
			};
		}

		switch (minion.minionType) {
			case 'toggle':
				return {
					light: '#42A5F5',
					dark: '#64B5F6'
				};
			case 'switch':
				return {
					light: '#26A69A',
					dark: '#4DB6AC'
				};
			case 'airConditioning':
				return {
					light: '#5C6BC0',
					dark: '#7986CB'
				};
			case 'light':
				return {
					light: '#66BB6A',
					dark: '#81C784'
				};
			case 'temperatureLight':
				return {
					light: '#66BB6A',
					dark: '#81C784'
				};
			case 'colorLight':
				return {
					light: '#66BB6A',
					dark: '#81C784'
				};
		}
	}

	public async toggleStatus(minion: Minion) {
		if (minion['other_keyup'] || minion['sync'] || minion.minionType === 'toggle') {
			return;
		}

		const minionStatus = minion['updateSet'][minion.minionType];
		/** For record mode, copy to updat set too */
		minion['updateSet'][minion.minionType].status = minionStatus.status === 'on' ? 'off' : 'on';

		await this.setStatus(minion, minion['updateSet']);
	}

	public async setOnOffStatus(minion: Minion, setStatus: SwitchOptions) {
		minion.minionStatus[minion.minionType].status = setStatus;

		await this.setStatus(minion, minion.minionStatus);
	}

	public async setStatus(minion: Minion, setStatus: MinionStatus) {
		if (minion['recordMode']) {
			return;
		}

		minion.minionStatus = setStatus;

		minion['sync'] = true;
		await this.minionsService.setStatus(minion);
	}

	public async recordCommand(minion: Minion) {
		minion['recording'] = true;

		await this.minionsService.recordCommand(minion, minion['updateSet']);

		minion['recording'] = false;
	}

	public showDeviceInfo(minion: Minion) { }

	public async refreshMinion(minion: Minion) {
		minion['sync'] = true;

		await this.minionsService.refreshMinion(minion);

		minion['sync'] = false;
	}

	public recordModePressed(minion: Minion) {
		if (minion['recordMode']) {
			minion['recordMode'] = undefined;
			this.createUpdateSet(minion);
			return;
		}

		minion['recordMode'] = true;
	}

	public async deleteMinion(minion: Minion) {
		const swalResult: void | SweetAlertResult = await swal({
			type: 'warning',
			title: `${this.translatePipe.transform('SURE')}?`,
			text: `${this.translatePipe.transform('BEFORE_DELETE_MESSAGE')} ${minion.name} ?`,
			showConfirmButton: true,
			confirmButtonColor: 'red',
			showCancelButton: true,
			confirmButtonText: this.translatePipe.transform('DELETE'),
			cancelButtonText: this.translatePipe.transform('CANCEL')
		});

		// Case user select 'cancel' cancel the delete.
		if (swalResult && swalResult.dismiss) {
			return;
		}

		minion['sync'] = true;
		this.minionsService.deleteMinion(minion);
	}

	public async createMinion() {

		// Select brand.
		const devices = {};
		for (const device of this.devicesService.lanDevices) {
			devices[device.mac] = `${device.name || ''} MAC: ${device.mac}, IP: ${device.ip}, VEN.: ${device.vendor ? device.vendor.substr(0, Math.min(device.vendor.length, 10)) : ''}`;
		}

		const swalDeviceResult: void | SweetAlertResult = await swal({
			title: `${this.translatePipe.transform('SELECT_DEVICE')}`,
			input: 'select',
			inputOptions: devices,
			inputPlaceholder: this.translatePipe.transform('SELECT_A_DEVICE'),
			showConfirmButton: true,
			showCancelButton: true,
			confirmButtonText: this.translatePipe.transform('SUBMIT'),
			cancelButtonText: this.translatePipe.transform('CANCEL'),
			onOpen: function () {
				swal.disableConfirmButton();
				swal.getInput().addEventListener('input', (e: KeyboardEvent) => {
					if (!e.target['value']) {
						swal.disableConfirmButton();
					} else {
						swal.enableConfirmButton();
					}
				});
			}
		});

		if (!swalDeviceResult.value) {
			return;
		}
		const selectedDevice = swalDeviceResult.value;

		// Select brand.
		const brands = {};
		for (const kind of this.devicesService.devicesKinds) {
			brands[kind.brand] = kind.brand;
		}

		const swalBrandResult: void | SweetAlertResult = await swal({
			title: `${this.translatePipe.transform('SELECT_BRAND')}`,
			input: 'select',
			inputOptions: brands,
			inputPlaceholder: this.translatePipe.transform('SELECT_A_BRAND'),
			showConfirmButton: true,
			showCancelButton: true,
			confirmButtonText: this.translatePipe.transform('SUBMIT'),
			cancelButtonText: this.translatePipe.transform('CANCEL'),
			onOpen: function () {
				swal.disableConfirmButton();
				swal.getInput().addEventListener('input', (e: KeyboardEvent) => {
					if (!e.target['value']) {
						swal.disableConfirmButton();
					} else {
						swal.enableConfirmButton();
					}
				});
			}
		});

		if (!swalBrandResult.value) {
			return;
		}
		const selectedBrand = swalBrandResult.value;

		// Select model.
		const models = {};
		for (const kind of this.devicesService.devicesKinds) {
			if (kind.brand === selectedBrand) {
				models[kind.model] = kind.model;
			}
		}

		const swalModelResult: void | SweetAlertResult = await swal({
			title: `${this.translatePipe.transform('SELECT_MODEL')}`,
			input: 'select',
			inputOptions: models,
			inputPlaceholder: this.translatePipe.transform('SELECT_A_MODEL'),
			showConfirmButton: true,
			showCancelButton: true,
			confirmButtonText: this.translatePipe.transform('SUBMIT'),
			cancelButtonText: this.translatePipe.transform('CANCEL'),
			onOpen: function () {
				swal.disableConfirmButton();
				swal.getInput().addEventListener('input', (e: KeyboardEvent) => {
					if (!e.target['value']) {
						swal.disableConfirmButton();
					} else {
						swal.enableConfirmButton();
					}
				});
			}
		});

		if (!swalModelResult.value) {
			return;
		}
		const selectedModel = swalModelResult.value;

		// Get the minion kind
		let selectedKind: DeviceKind;
		for (const kind of this.devicesService.devicesKinds) {
			if (kind.brand === selectedBrand && kind.model === selectedModel) {
				selectedKind = kind;
				break;
			}
		}

		let deviceToken: string;
		if (selectedKind.isTokenRequierd) {
			const swalTokenResult: void | SweetAlertResult = await swal({
				title: `${this.translatePipe.transform('ENTER_TOKEN')}`,
				input: 'text',
				inputPlaceholder: this.translatePipe.transform('ENTER_TOKEN_HERE'),
				showConfirmButton: true,
				showCancelButton: true,
				confirmButtonText: this.translatePipe.transform('SUBMIT'),
				cancelButtonText: this.translatePipe.transform('CANCEL'),
				onOpen: function () {
					swal.disableConfirmButton();
					swal.getInput().addEventListener('input', (e: KeyboardEvent) => {
						if (!e.target['value']) {
							swal.disableConfirmButton();
						} else {
							swal.enableConfirmButton();
						}
					});
				}
			});

			if (!swalTokenResult.value) {
				return;
			}
			deviceToken = swalTokenResult.value;
		}

		let deviceId: string;
		if (selectedKind.isIdRequierd) {
			const swalIdResult: void | SweetAlertResult = await swal({
				title: `${this.translatePipe.transform('ENTER_ID')}`,
				input: 'text',
				inputPlaceholder: this.translatePipe.transform('ENTER_ID_HERE'),
				showConfirmButton: true,
				showCancelButton: true,
				confirmButtonText: this.translatePipe.transform('SUBMIT'),
				cancelButtonText: this.translatePipe.transform('CANCEL'),
				onOpen: function () {
					swal.disableConfirmButton();
					swal.getInput().addEventListener('input', (e: KeyboardEvent) => {
						if (!e.target['value']) {
							swal.disableConfirmButton();
						} else {
							swal.enableConfirmButton();
						}
					});
				}
			});

			if (!swalIdResult.value) {
				return;
			}
			deviceId = swalIdResult.value;
		}

		const swalNameResult: void | SweetAlertResult = await swal({
			title: `${this.translatePipe.transform('ENTER_NAME')}`,
			input: 'text',
			inputPlaceholder: this.translatePipe.transform('ENTER_NAME_HERE'),
			showConfirmButton: true,
			showCancelButton: true,
			confirmButtonText: this.translatePipe.transform('CREATE_MINION'),
			cancelButtonText: this.translatePipe.transform('CANCEL'),
			showLoaderOnConfirm: true,
			onOpen: function () {
				swal.disableConfirmButton();
				swal.getInput().addEventListener('input', (e: KeyboardEvent) => {
					if (!e.target['value']) {
						swal.disableConfirmButton();
					} else {
						swal.enableConfirmButton();
					}
				});
			},
		});

		if (!swalNameResult.value) {
			return;
		}

		await this.minionsService.createMinion({
			device: {
				brand: selectedBrand,
				model : selectedModel,
				deviceId : deviceId,
				token: deviceToken,
				pysicalDevice : {
					mac : selectedDevice,
				}
			},
			name : swalNameResult.value,
			minionType: 'toggle',
			minionStatus : { }
		})
	}

	public async refreshMinions() {
		this.minions = [];
		this.dataLoading = true;

		await this.minionsService.refreshMinions();
	}

	public async reScanNetwordAndRefreshMinions() {
		this.minions = [];
		this.dataLoading = true;

		await this.devicesService.rescanLanDevices();
		await this.refreshMinions();
	}

	public loadChangeColor(colorLight: ColorLight, setRgbHexColor: string) {
		const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(setRgbHexColor);
		colorLight.red = Math.floor(parseInt(result[1], 16)) as ColorOptions;
		colorLight.green = Math.floor(parseInt(result[2], 16)) as ColorOptions;
		colorLight.blue = Math.floor(parseInt(result[3], 16)) as ColorOptions;
	}

	private componentToHex(c: number) {
		const hex = c.toString(16);
		return hex.length === 1 ? '0' + hex : hex;
	}

	public rgbToHex(colorLight: ColorLight) {
		return (
			'#' +
			this.componentToHex(colorLight.red) +
			this.componentToHex(colorLight.green) +
			this.componentToHex(colorLight.blue)
		);
	}
}
