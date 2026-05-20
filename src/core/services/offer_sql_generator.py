import time
import random
from datetime import datetime

class OfferSqlGenerator:
    def __init__(self, data: dict):
        self.data = data
        self.sqls = []

        self.ofr_name = self.data.get('OFR_NAME', '')
        self.ofr_desc = self.data.get('OFR_DESC', '')
        self.market_price = self.data.get('MARKET_PRICE', '')
        self.ofr_sub_type = self.data.get('OFR_SUB_TYPE', '1101')
        self.tele_type = self.data.get('TELE_TYPE', 'GSM')
        self.group_flag = self.data.get('GROUP_FLAG', '0')
        self.group_type = self.data.get('GROUP_TYPE', '')
        self.ofr_mode_type = self.data.get('OFR_MODE_TYPE', '')
        self.sub_mode_type = self.data.get('SUB_MODE_TYPE', '')
        self.exp_type = self.data.get('EXP_TYPE', '')
        self.exp_value = self.data.get('EXP_VALUE', '')
        self.repeat_flag = self.data.get('REPEAT_FLAG', '')
        self.ota_ofr_desc = self.data.get('OTA_OFR_DESC', '')
        self.ofr_rent = self.data.get('OFRRENT', '')
        self.ota_advantage_desc = self.data.get('OTA_ADVANTAGE_DESC', '')
        self.call_time = self.data.get('CALL_TIME', '')
        self.flow = self.data.get('FLOW', '')
        self.sms_num = self.data.get('SMS_NUM', '')
        self.ext_call_standard = self.data.get('EXT_CALL_STANDARD', '')
        self.ext_flow_standard = self.data.get('EXT_FLOW_STANDARD', '')
        self.ext_sms_standard = self.data.get('EXT_SMS_STANDARD', '')

        self.product_type = self.data.get('PRODUCT_TYPE', 'T')
        self.prod_sub_type = self.data.get('PROD_SUB_TYPE', 'M')

        self.prod_price_type = self.data.get('PROD_PRICE_TYPE', '01')
        self.prod_level = self.data.get('PROD_LEVEL', '00')

        self.rent_type = self.data.get('RENT_TYPE', '10131')
        self.full_num = self.data.get('FULL_NUM', '1')

        self.offset_expression = self.data.get('OFFSET_EXPRESSION', '')
        self.state_ref_mode = self.data.get('STATE_REF_MODE', '1')
        self.state_group = self.data.get('STATE_GROUP', '')
        self.other_expression = self.data.get('OTHER_EXPRESSION', '')

        self.fee_code = self.data.get('FEE_CODE', '')
        self.cycle_unit = self.data.get('CYCLE_UNIT', '20')
        self.cycles = self.data.get('CYCLES', '1')
        self.rate = self.data.get('RATE', '')
        self.part_flag = self.data.get('PART_FLAG', '0')
        self.rate_comments = self.data.get('RATE_COMMENTS', '')

        self.has_present = self.data.get('HAS_PRESENT', False)
        self.balance_type = self.data.get('BALANCE_TYPE', '')
        self.amount_type = self.data.get('AMOUNT_TYPE', '1')
        self.amount = self.data.get('AMOUNT', '')
        self.cycle_type = self.data.get('CYCLE_TYPE', '1')
        self.cycle_amount = self.data.get('CYCLE_AMOUNT', '')
        self.offset = self.data.get('OFFSET', '')
        self.rule_present_flag = self.data.get('RULE_PRESENT_FLAG', '1')

        self.ofr_id = self._generate_ofr_id()
        self.product_id = self._generate_product_id()
        self.rent_plan_id = self._generate_rent_plan_id()
        self.rent_policy_id = self._generate_rent_policy_id()
        self.rate_id = self._generate_rate_id()
        self.present_rule_id = self._generate_present_rule_id() if self.has_present else None

    def _generate_ofr_id(self):
        timestamp = int(time.time())
        rand_str = f"{random.randint(0, 9999999):07d}"
        return f"OF{timestamp}{rand_str}"[:20]

    def _generate_product_id(self):
        timestamp = int(time.time())
        rand_str = f"{random.randint(0, 9999999):07d}"
        return f"P{timestamp}{rand_str}"[:20]

    def _generate_rent_plan_id(self):
        timestamp = int(time.time())
        rand_str = f"{random.randint(0, 99999):05d}"
        return f"RP{timestamp}{rand_str}"[:30]

    def _generate_rent_policy_id(self):
        timestamp = int(time.time())
        rand_str = f"{random.randint(0, 999):03d}"
        return f"RPC{timestamp}{rand_str}"[:30]

    def _generate_rate_id(self):
        timestamp = int(time.time())
        rand_str = f"{random.randint(0, 999):03d}"
        return f"RR{timestamp}{rand_str}"[:30]

    def _generate_present_rule_id(self):
        timestamp = int(time.time())
        rand_str = f"{random.randint(0, 999):03d}"
        return f"PR{timestamp}{rand_str}"[:30]

    def _escape(self, val):
        if val is None or str(val).strip() == '':
            return "null"
        escaped_val = str(val).replace("'", "''")
        return f"'{escaped_val}'"

    def _get_flag_4g(self):
        if self.tele_type == 'GSM':
            return "'5G03'"
        else:
            return "'4G'"

    def generate(self):
        self.sqls.append("-- 1. 销售品表 crm_ofr.CODE_OFR")
        self._gen_code_ofr()

        self.sqls.append("\n-- 2. 产品表 crm_product.CODE_PRODUCT")
        self._gen_code_product()

        self.sqls.append("\n-- 3. 套餐产品属性表 crm_product.CODE_PRODUCT_DINNER_ATTR")
        self._gen_code_product_dinner_attr()

        self.sqls.append("\n-- 4. 销售品产品关联表 crm_ofr.RULE_OFR_PRODUCT")
        self._gen_rule_ofr_product()

        self.sqls.append("\n-- 5. 月租费率表 router.RENT_RATE")
        self._gen_rent_rate()

        if self.has_present:
            self.sqls.append("\n-- 6. 赠送规则表 router.RULE_PRESENT")
            self._gen_rule_present()

        self.sqls.append("\n-- 7. 月租策略表 router.RENT_POLICY")
        self._gen_rent_policy()

        self.sqls.append("\n-- 8. 月租计划表 router.RENT_PLAN")
        self._gen_rent_plan()

        self.sqls.append("\n-- 9. 月租属性信息表 router.RENT_OFFER")
        self._gen_rent_offer()

        return "\n".join(self.sqls)

    def _gen_code_ofr(self):
        sql = f"insert into crm_ofr.CODE_OFR (OFR_ID, OFR_NAME, OFR_DESC, MARKET_PRICE, OFR_STATUS, EFF_FLAG, EFF_DATE, EXP_DATE, EXCLUDE_CODE, RULE_ID, OFR_TYPE, OFR_SUB_TYPE, TELE_TYPE, OPER_DATE, IN_SYSC, BRAND_CODE, FLAG_4G, GROUP_FLAG, GROUP_TYPE, DISPLAY_FLAG, OFR_MODE_TYPE, SUB_MODE_TYPE, EXP_TYPE, EXP_VALUE, REPEAT_FLAG, IS_COMPARE, OTA_OFR_DESC, NEW_BRAND_CODE, OFR_RENT, OFR_SUB_TYPE_EX, OTA_SORT, OTA_ADVANTAGE_DESC, B_VALUE_FLAG, CALL_TIME, FLOW, SMS_NUM, EXT_CALL_STANDARD, EXT_FLOW_STANDARD, EXT_SMS_STANDARD) values ({self._escape(self.ofr_id)}, {self._escape(self.ofr_name)}, {self._escape(self.ofr_desc)}, {self.market_price if self.market_price else 'null'}, '101', 'Y', sysdate, to_date('31-12-2099 23:59:59', 'dd-mm-yyyy hh24:mi:ss'), null, 0, '11', {self._escape(self.ofr_sub_type)}, {self._escape(self.tele_type)}, sysdate, '0', '01', {self._get_flag_4g()}, {self._escape(self.group_flag)}, {self._escape(self.group_type)}, 'Y', {self._escape(self.ofr_mode_type)}, {self._escape(self.sub_mode_type)}, {self._escape(self.exp_type)}, {self._escape(self.exp_value)}, {self._escape(self.repeat_flag)}, '0', {self._escape(self.ota_ofr_desc)}, '01', {self.ofr_rent if self.ofr_rent else 'null'}, '110200', 0, {self._escape(self.ota_advantage_desc)}, '0', {self.call_time if self.call_time else 'null'}, {self.flow if self.flow else 'null'}, {self.sms_num if self.sms_num else 'null'}, {self._escape(self.ext_call_standard)}, {self._escape(self.ext_flow_standard)}, {self._escape(self.ext_sms_standard)});"
        self.sqls.append(sql)

    def _gen_code_product(self):
        sql = f"insert into crm_product.CODE_PRODUCT (PRODUCT_ID, PRODUCT_NAME, PRODUCT_DESC, PRODUCT_TYPE, PRODUCT_PRICE, PRODUCT_STATUS, DEPT_ID, EXCLUDE_CODE, EFF_FLAG, EFF_DATE, EXP_DATE, BAR_CODE, TELE_TYPE, PROD_SUB_TYPE) values ({self._escape(self.product_id)}, {self._escape(self.ofr_name)}, {self._escape(self.ofr_desc)}, {self._escape(self.product_type)}, {self.market_price if self.market_price else 'null'}, '101', '109', null, '0', sysdate, to_date('31-12-2099 23:59:59', 'dd-mm-yyyy hh24:mi:ss'), null, {self._escape(self.tele_type)}, {self._escape(self.prod_sub_type)});"
        self.sqls.append(sql)

    def _gen_code_product_dinner_attr(self):
        sql = f"insert into crm_product.CODE_PRODUCT_DINNER_ATTR (PRODUCT_ID, TELE_TYPE, WS_FINISH_FLAG, CREDIT_LEVEL, PROD_PRICE_TYPE, PROD_LEVEL, EFF_TYPE, OPEN_ORDER_FLAG) values ({self._escape(self.product_id)}, {self._escape(self.tele_type)}, '1', '1', {self._escape(self.prod_price_type)}, {self._escape(self.prod_level)}, '0', '*');"
        self.sqls.append(sql)

    def _gen_rule_ofr_product(self):
        ofr_product_id = f"to_char(sysdate ,'yyyymmddHH24miss')||crm_user.seq_get_id.nextval"
        sql = f"insert into crm_ofr.RULE_OFR_PRODUCT (OFR_PRODUCT_ID, OFR_ID, PRODUCT_ID, GROUP_NO, GROUP_NAME, EXCLUDE_FLAG, CHOICE_STATUS, DISPLAY_ORDER, ORDER_NUM) values ({ofr_product_id}, {self._escape(self.ofr_id)}, {self._escape(self.product_id)}, '0', null, '0', '100', null, 1);"
        self.sqls.append(sql)

    def _gen_rent_rate(self):
        sql = f"insert into router.RENT_RATE (RATE_ID, FEE_CODE, RATE_MODE, FREE_MEMBERS, MEMBER_RATE, MEMBER_EFF_MODE, CYCLE_UNIT, CYCLES, RATE, EXPRESSION_ID, PART_FLAG, EFF_DATE, EXP_DATE, COMMENTS, REF_CODE_TYPE, REF_CODE, OFFSET_CYCLE) values ({self._escape(self.rate_id)}, {self._escape(self.fee_code)}, 1, 0, 0, 0, {self.cycle_unit}, {self.cycles}, {self.rate}, 'isTrue', {self.part_flag}, sysdate, to_date('31-12-2099 23:59:59', 'dd-mm-yyyy hh24:mi:ss'), {self._escape(self.rate_comments)}, 0, '0', 0);"
        self.sqls.append(sql)

    def _gen_rule_present(self):
        if not self.has_present or not self.present_rule_id:
            return
        sql = f"insert into router.RULE_PRESENT (PRESENT_RULE_ID, BALANCE_TYPE, AMOUNT_TYPE, AMOUNT, PRESENT_MODE, CYCLE_TYPE, CYCLE_AMOUNT, OFFSET, CONDITION_ID, EXPRESSION_ID, PRIORITY, RULE_PRESENT_FLAG) values ({self._escape(self.present_rule_id)}, {self.balance_type}, {self.amount_type}, {self.amount}, 1, {self.cycle_type}, {self.cycle_amount}, {self.offset}, 'isTrue', 'isTrue', 0, {self.rule_present_flag});"
        self.sqls.append(sql)

    def _gen_rent_policy(self):
        present_rule_id_str = "null"
        if self.has_present and self.present_rule_id:
            present_rule_id_str = self._escape(self.present_rule_id)
        sql = f"insert into router.RENT_POLICY (RENT_POLICY_ID, RATE_ID, PRESENT_RULE_ID) values ({self._escape(self.rent_policy_id)}, {self._escape(self.rate_id)}, {present_rule_id_str});"
        self.sqls.append(sql)

    def _gen_rent_plan(self):
        sql = f"insert into router.RENT_PLAN (RENT_PLAN_ID, OFFSET_EXPRESSION, STATE_REF_MODE, STATE_GROUP, OTHER_EXPRESSION, RENT_POLICY_ID, OLD_OFR_ID) values ({self._escape(self.rent_plan_id)}, {self._escape(self.offset_expression)}, {self.state_ref_mode}, {self._escape(self.state_group)}, {self._escape(self.other_expression)}, {self._escape(self.rent_policy_id)}, {self._escape(self.product_id)});"
        self.sqls.append(sql)

    def _gen_rent_offer(self):
        sql = f"insert into router.RENT_OFFER (PRODUCT_ID, RENT_PLAN_ID, RERENT_FLAG, RENT_TYPE, CALC_TYPE, STAND_RATE, FULL_PAY, FULL_NUM, SINGLE_FLAG) values ({self._escape(self.product_id)}, {self._escape(self.rent_plan_id)}, 0, {self.rent_type}, 1, 0, 0, {self.full_num}, 0);"
        self.sqls.append(sql)
