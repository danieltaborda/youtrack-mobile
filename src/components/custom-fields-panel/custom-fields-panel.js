/* @flow */
import {View, ScrollView, Text, TouchableOpacity, TextInput, ActivityIndicator} from 'react-native';
import React, {Component} from 'react';
import CalendarPicker from 'react-native-calendar-picker/CalendarPicker/CalendarPicker';
import CustomField from '../custom-field/custom-field';
import Select from '../select/select';
import Header from '../header/header';
import {COLOR_PINK} from '../../components/variables/variables';
import KeyboardSpacer from 'react-native-keyboard-spacer';
import Api from '../api/api';
import IssuePermissions from '../issue-permissions/issue-permissions';
import styles from './custom-fields-panel.styles';

type Props = {
  api: Api,
  issue: IssueFull,
  issuePermissions: IssuePermissions,
  onUpdate: (field: CustomField) => any,
  onUpdateProject: (project: IssueProject) => Promise<Object>,
  canEditProject: boolean
};

type State = {
  topCoord: number,
  height: number,
  editingField: ?CustomField,
  savingField: ?CustomField,
  isEditingProject: boolean,
  isSavingProject: boolean,

  select: {
    show: boolean,
    dataSource: (query: string) => Promise<Array<Object>>,
    onSelect: (item: any) => any,
    multi: boolean,
    emptyValue?: ?string,
    selectedItems: Array<Object>,
    getValue?: (item: Object) => string,
    getTitle?: (item: Object) => string
  },

  datePicker: {
    show: boolean,
    title: string,
    value: Date,
    onSelect: (selected: any) => any
  },

  simpleValue: {
    show: boolean,
    value: ?string,
    placeholder: string,
    onApply: () => any
  }
}

const initialEditorsState = {
  select: {
    show: false,
    dataSource: () => Promise.resolve([]),
    onSelect: () => {},
    multi: false,
    selectedItems: []
  },

  datePicker: {
    show: false,
    title: '',
    value: new Date(),
    onSelect: () => {
    }
  },

  simpleValue: {
    show: false,
    value: null,
    placeholder: '',
    onApply: () => {}
  }
};

export default class CustomFieldsPanel extends Component {
  props: Props;
  state: State;

  constructor() {
    super();

    this.state = {
      topCoord: 0,
      height: 0,
      editingField: null,
      savingField: null,
      isEditingProject: false,
      isSavingProject: false,
      ...initialEditorsState
    };
  }

  measureSelect() {
    setTimeout(() => {
      this.refs.customFieldsPanelMarker.measure((ox, oy, width, height, px, panelPositionY) => {
        this.setState({topCoord: panelPositionY, height: height});
      });
    });
  }

  componentDidMount() {
    this.measureSelect();
  }

  saveUpdatedField(field: CustomField, value: null|number|Object) {
    this.closeEditor();
    this.setState({savingField: field});

    return this.props.onUpdate(field, value)
      .then(res => {
        this.setState({savingField: null});
        return res;
      })
      .catch(() => this.setState({savingField: null}));
  }

  onSelectProject() {
    if (this.state.isEditingProject) {
      return this.closeEditor();
    }

    this.closeEditor();
    this.setState({
      isEditingProject: true,
      select: {
        show: true,
        getValue: project => project.name + project.shortName,
        dataSource: this.props.api.getProjects.bind(this.props.api),
        multi: false,
        selectedItems: [],
        onSelect: (project: IssueProject) => {
          this.closeEditor();
          this.setState({isSavingProject: true});
          return this.props.onUpdateProject(project)
            .then(() => this.setState({isSavingProject: false}));
        }
      }
    });
  }

  closeEditor() {
    return new Promise(resolve => {
      this.setState({
        editingField: null,
        isEditingProject: false,
        ...initialEditorsState
      }, resolve);
    });
  }

  editDateField(field: CustomField) {
    return this.setState({
      datePicker: {
        show: true,
        title: field.projectCustomField.field.name,
        value: field.value ? new Date(field.value) : new Date(),
        emptyValueName: field.projectCustomField.canBeEmpty ? field.projectCustomField.emptyFieldText : null,
        onSelect: (date) => this.saveUpdatedField(field, date ? date.getTime() : null)
      }
    });
  }

  editSimpleValueField(field: CustomField, type: string) {
    const isInteger = type === 'integer';
    const placeholder = isInteger ? '-12 or 34' : '1w 1d 1h 1m';
    const valueFormatter = isInteger ?
      value => parseInt(value) :
      value => ({presentation: value});

    return this.setState({
      simpleValue: {
        show: true,
        placeholder: placeholder,
        value: field.value ? field.value.presentation : null,
        onApply: (value) => this.saveUpdatedField(field, valueFormatter(value))
      }
    });
  }

  editCustomField(field: CustomField) {
    const isMultiValue = field.projectCustomField.field.fieldType.isMultiValue;
    let selectedItems;
    if (isMultiValue) {
      selectedItems = field.value;
    } else {
      selectedItems = field.value ? [field.value] : [];
    }

    return this.setState({
      select: {
        show: true,
        multi: isMultiValue,
        selectedItems: selectedItems,
        emptyValue: field.projectCustomField.canBeEmpty ? field.projectCustomField.emptyFieldText : null,
        dataSource: (query) => {
          if (field.hasStateMachine) {
            return this.props.api.getStateMachineEvents(this.props.issue.id, field.id)
              .then(items => items.map(it => Object.assign(it, {name: `${it.id} (${it.presentation})`})));
          }
          return this.props.api.getCustomFieldValues(field.projectCustomField.bundle.id, field.projectCustomField.field.fieldType.valueType)
            .then(res => res.aggregatedUsers || res.values);
        },
        onSelect: (value) => this.saveUpdatedField(field, value)
      }
    });
  }

  onEditField(field: CustomField) {
    if (field === this.state.editingField) {
      return this.closeEditor();
    }

    return this.closeEditor()
      .then(() => {
        this.setState({editingField: field});

        if (field.projectCustomField.field.fieldType.valueType === 'date') {
          return this.editDateField(field);
        }

        if (['period', 'integer'].indexOf(field.projectCustomField.field.fieldType.valueType) !== -1) {
          return this.editSimpleValueField(field, field.projectCustomField.field.fieldType.valueType);
        }

        return this.editCustomField(field);
      });
  }

  _renderSelect() {
    if (!this.state.select.show) {
      return;
    }

    return <Select
      {...this.state.select}
      style={{
          top: -this.state.topCoord,
          bottom: this.state.height
        }}
      height={this.state.topCoord}
      title="Select item"
      api={this.props.api}
      onCancel={() => this.closeEditor()}
      getTitle={(item) => item.fullName || item.name || item.login}
    />;
  }

  _renderDatePicker() {
    if (!this.state.datePicker.show) {
      return;
    }

    return (
      <View style={[styles.editorViewContainer, {
          top: -this.state.topCoord,
          bottom: this.state.height
      }]}>
        <Header
          leftButton={<Text>Cancel</Text>}
          rightButton={<Text></Text>}
          onBack={() => this.closeEditor()}>
          <Text>{this.state.datePicker.title}</Text>
        </Header>
        <View style={styles.calendar}>
          {this.state.datePicker.emptyValueName &&
          <TouchableOpacity onPress={() => this.state.datePicker.onSelect(null)}>
            <Text style={styles.clearDate}>{this.state.datePicker.emptyValueName} (Clear value)</Text>
          </TouchableOpacity>}

          <CalendarPicker
            selectedDate={this.state.datePicker.value}
            startFromMonday={true}
            weekdays={['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']}
            onDateChange={date => {
              if (this.state.datePicker.value.getMonth() !== date.getMonth()) {
                this.state.datePicker.value = date;
                return this.setState({datePicker: this.state.datePicker});
              }
              return this.state.datePicker.onSelect(date);
            }}
            selectedDayColor={COLOR_PINK}
            selectedDayTextColor="#FFF"/>
        </View>
      </View>
    );
  }

  _renderSimpleValueInput() {
    if (!this.state.simpleValue.show || !this.state.editingField) {
      return;
    }

    return (
      <View style={[styles.editorViewContainer, {
          top: -this.state.topCoord,
          bottom: this.state.height
      }]}>
        <Header
          leftButton={<Text>Cancel</Text>}
          onBack={() => this.closeEditor()}>
          <Text>{this.state.editingField.projectCustomField.field.name}</Text>
        </Header>
        <View>
          <TextInput
            style={styles.simpleValueInput}
            placeholder={this.state.simpleValue.placeholder}
            underlineColorAndroid="transparent"
            clearButtonMode="always"
            returnKeyType="done"
            autoCorrect={false}
            autoFocus={true}
            autoCapitalize="none"
            onChangeText={(text) => {
              this.state.simpleValue.value = text;
              this.forceUpdate();
            }}
            onSubmitEditing={() => this.state.simpleValue.onApply(this.state.simpleValue.value)}
            value={this.state.simpleValue.value}/>
        </View>
      </View>
    );
  }

  render() {
    const issue = this.props.issue;

    return (
      <View ref="panel">
        <View style={{height: 0, width: 0, opacity: 0}} ref="customFieldsPanelMarker">
          <KeyboardSpacer onToggle={() => this.measureSelect()}/>
        </View>
        {this._renderSelect()}

        {this._renderDatePicker()}

        {this._renderSimpleValueInput()}

        <ScrollView horizontal={true} style={styles.customFieldsPanel}>
          <View key="Project">
            <CustomField disabled={!this.props.canEditProject}
                         onPress={() => this.onSelectProject()}
                         active={this.state.isEditingProject}
                         field={{projectCustomField: {field: {name: 'Project'}}, value: {name: issue.project.shortName}}}/>
            {this.state.isSavingProject && <ActivityIndicator style={styles.savingFieldIndicator}/>}
          </View>

          {issue.fields.map((field) => {
            return <View key={field.id}>

              <CustomField
                field={field}
                onPress={() => this.onEditField(field)}
                active={this.state.editingField === field}
                disabled={!this.props.issuePermissions.canUpdateField(issue, field)}/>

              {this.state.savingField === field && <ActivityIndicator style={styles.savingFieldIndicator}/>}
            </View>;
          })}
        </ScrollView>
      </View>
    );
  }
}
